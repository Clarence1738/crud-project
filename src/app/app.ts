import { afterNextRender, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from './auth.service';
import { FarmService } from './farm.service';
import { errorMessage } from './api.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, RouterOutlet],
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
  readonly menuOpen = signal(false);
  readonly sections = [
    { label: 'Dashboard', icon: 'home', route: '/dashboard' },
    { label: 'Farms', icon: 'home', route: '/farms' },
    { label: 'Crops', icon: 'product', route: '/crops' },
    { label: 'Livestock', icon: 'food', route: '/livestock' },
    { label: 'Crop activities', icon: 'event', route: '/activities' },
    { label: 'Animal health', icon: 'favorites', route: '/health' },
    { label: 'Fields', icon: 'map', route: '/fields' },
    { label: 'Inventory', icon: 'box', route: '/inventory' },
    { label: 'Tasks', icon: 'checklist', route: '/tasks' },
    { label: 'Equipment', icon: 'toolbox', route: '/equipment' },
    { label: 'Finance', icon: 'money', route: '/finance' },
    { label: 'Documents', icon: 'file', route: '/documents' },
  ];
  private readonly router = inject(Router);
  private readonly farms = inject(FarmService);
  readonly section = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => this.sectionFor(event.urlAfterRedirects)),
    ),
    { initialValue: this.sectionFor(this.router.url) },
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
      this.farms.clearSelection();
      this.email = '';
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.loginError.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  navigate(route: string): void {
    this.menuOpen.set(false);
    void this.router.navigateByUrl(route);
  }

  private sectionFor(url: string): number {
    const path = url.split(/[?#]/)[0];
    return Math.max(0, this.sections.findIndex((item) => item.route === path));
  }
}
