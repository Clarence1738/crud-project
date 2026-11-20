import { afterNextRender, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DxTabsComponent } from 'devextreme-angular/ui/tabs';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from './auth.service';
import { errorMessage } from './api.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, RouterOutlet, DxTabsComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  readonly loginError = signal('');
  email = '';
  password = '';
  name = '';
  confirmation = '';
  registering = false;
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly sections = [{ text: 'Shipments' }, { text: 'Private documents' }];
  private readonly router = inject(Router);
  readonly section = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => (event.urlAfterRedirects.split(/[?#]/)[0] === '/documents' ? 1 : 0)),
    ),
    { initialValue: this.router.url === '/documents' ? 1 : 0 },
  );

  constructor() {
    afterNextRender(() => {
      void this.initialize();
    });
  }

  private async initialize(): Promise<void> {
    try {
      await this.auth.restore();
    } catch (error) {
      this.loginError.set(errorMessage(error));
    } finally {
      this.ready.set(true);
    }
  }

  async login(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.loginError.set('');
    try {
      if (this.registering)
        await this.auth.register(this.name, this.email, this.password, this.confirmation);
      else await this.auth.login(this.email, this.password);
    } catch (error) {
      this.loginError.set(errorMessage(error));
    } finally {
      this.password = '';
      this.confirmation = '';
      this.busy.set(false);
    }
  }

  async logout(): Promise<void> {
    if (this.busy()) return;
    this.loginError.set('');
    this.busy.set(true);
    try {
      await this.auth.logout();
      this.email = '';
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.loginError.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  changeSection(index: number): void {
    if (index === this.section()) return;
    if (index === 0 || index === 1) {
      void this.router.navigateByUrl(index === 1 ? '/documents' : '/');
    }
  }
}
