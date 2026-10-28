// Appended to the unmodified SoundTouchJS 2.1.1 bundle by vendor-audio.mjs.
// SoundTouchJS portions retain MPL-2.0 and their upstream notices.
// Constructor adapter: Copyright 2026 Gaerisson.
import {keyLockProfile as silloraKeyLockProfile} from '../../keylock-profiles.mjs';
class SilloraKeyLockProcessor extends SoundTouchProcessor{
 constructor(options){
  super(options);
  const profile=silloraKeyLockProfile(options?.processorOptions?.keyLockProfile);
  if(profile.settings)this._pipe.setStretchParameters(profile.settings);
 }
}
registerProcessor('sillora-keylock',SilloraKeyLockProcessor);
