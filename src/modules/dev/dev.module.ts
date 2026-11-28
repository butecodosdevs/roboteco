import { type Client, Events } from 'discord.js';
import { inject, Module, type OnReady } from '@/core';
import { DevCommand } from './commands/dev/dev.command';
import { FidelityButton } from './components/fidelity.button';
import { FidelityModal } from './components/fidelity.modal';
import { FidelitySelect } from './components/fidelity.select';
import { FidelityMessageContextMenu } from './context-menus/fidelity-message.context-menu';
import { FidelityUserContextMenu } from './context-menus/fidelity-user.context-menu';
import { RecorderService } from './recorder.service';

/** Tools for testing the bot by hand. `AppModule` only loads it when NODE_ENV is development. */
@Module({
  commands: [DevCommand],
  contextMenus: [FidelityUserContextMenu, FidelityMessageContextMenu],
  components: [FidelityButton, FidelitySelect, FidelityModal],
})
export class DevModule implements OnReady {
  private readonly recorder = inject(RecorderService);

  onReady(client: Client<true>) {
    client.on(Events.Raw as never, (packet: { t?: string | null; d?: unknown }) =>
      this.recorder.capture(packet, client.user.id),
    );
  }
}
