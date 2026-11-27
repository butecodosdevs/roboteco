import { inject, Module } from '@/core';
import { PanelAuthService } from './panel-auth.service';
import { registerPanelSettings } from './panel-settings.service';

@Module({})
export class PanelModule {
  constructor() {
    // Registered at construction instead of on ready: the login screen has to answer while the
    // gateway is still connecting, which is exactly when someone opens the panel to fix a token.
    void inject(PanelAuthService).start();
    registerPanelSettings();
  }
}
