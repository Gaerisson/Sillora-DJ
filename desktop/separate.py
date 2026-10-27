"""Local four-stem preparation. No audio is sent to a service."""
import json
import os
import sys
from pathlib import Path

def emit(**data):
    print(json.dumps(data), flush=True)

def main():
    import numpy as np
    import soundfile as sf
    import torch
    from demucs.pretrained import get_model
    from demucs.apply import apply_model
    from demucs.audio import convert_audio

    source, destination = map(Path, sys.argv[1:3])
    destination.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(min(4, os.cpu_count() or 2))
    torch.manual_seed(0)
    data, rate = sf.read(source, dtype='float32', always_2d=True)
    if not 1 <= data.shape[1] <= 2 or not np.isfinite(data).all():
        raise ValueError('Signal audio invalide.')
    emit(stage='model')
    checkpoint = Path(os.environ.get('TORCH_HOME', ''))/'hub'/'checkpoints'/'955717e8-8726e21a.th'
    if not checkpoint.is_file():
        raise ValueError('Modèle htdemucs intégré absent. Aucun téléchargement automatique ne sera effectué.')
    device='cuda' if torch.cuda.is_available() and os.environ.get('SILLAGE_STEMS_DEVICE')!='cpu' else 'cpu'
    model = get_model('htdemucs').eval().to(device)
    mix = convert_audio(torch.from_numpy(data.T.copy()), rate, model.samplerate, model.audio_channels)
    reference = mix.mean(0)
    mean, std = reference.mean(), reference.std().clamp_min(1e-5)
    emit(stage='separating', model='htdemucs', sources=model.sources,device=device)
    with torch.inference_mode():
        estimates = apply_model(model, ((mix-mean)/std)[None], device=device, shifts=0,
                                split=True, segment=5.5 if device=='cuda' else None,overlap=.25, progress=True, num_workers=0)[0].cpu()
        estimates = estimates*std+mean
        # Preserve the original full mix, without separately normalizing stems.
        # Residual model error goes to the accompaniment.
        estimates[model.sources.index('other')] += mix-estimates.sum(0)
    emit(stage='writing')
    converted=[]
    for estimate in estimates:
        stem=convert_audio(estimate, model.samplerate, rate, 2)
        if stem.shape[-1]<len(data):
            stem=torch.nn.functional.pad(stem,(0,len(data)-stem.shape[-1]))
        converted.append(stem[...,:len(data)])
    converted=torch.stack(converted)
    original=torch.from_numpy(data.T.copy())
    if original.shape[0]==1:
        original=original.repeat(2,1)
    converted[model.sources.index('other')]+=original-converted.sum(0)
    for index, name in enumerate(model.sources):
        if name not in ('drums', 'bass', 'other', 'vocals'):
            raise ValueError('Source inconnue.')
        stem = converted[index].numpy().T
        if not np.isfinite(stem).all():
            raise ValueError('Résultat audio non fini.')
        sf.write(destination/(name+'.wav'), stem, rate, subtype='FLOAT')
    manifest = dict(model='htdemucs', sources=model.sources, sampleRate=rate,
                    frames=len(data), mixtureConsistency=True, version=1,device=device)
    (destination/'complete.json').write_text(json.dumps(manifest), encoding='utf-8')
    emit(stage='done', **manifest)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        emit(stage='error', error=str(error))
        sys.exit(1)
