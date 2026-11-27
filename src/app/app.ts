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
  styleUrls: ['./app.css', './app-login.css'],
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
  readonly sections: { label: string; icon: string; route: string; group: string; adminOnly?: boolean }[] = [
    { group: 'Overview', label: 'Dashboard', icon: 'home', route: '/dashboard' },
    { group: 'Farm setup', label: 'Farms', icon: 'globe', route: '/farms' },
    { group: 'Farm setup', label: 'Fields', icon: 'map', route: '/fields' },
    { group: 'Crops', label: 'Crop seasons', icon: 'product', route: '/crops' },
    { group: 'Crops', label: 'Crop activities', icon: 'event', route: '/activities' },
    { group: 'Crops', label: 'Harvests', icon: 'box', route: '/harvests' },
    { group: 'Crops', label: 'Losses and incidents', icon: 'warning', route: '/incidents' },
    { group: 'Livestock', label: 'Livestock', icon: 'food', route: '/livestock' },
    { group: 'Livestock', label: 'Animal health', icon: 'favorites', route: '/health' },
    { group: 'Livestock', label: 'Breeding', icon: 'like', route: '/breeding' },
    { group: 'Livestock', label: 'Births', icon: 'add', route: '/births' },
    { group: 'Livestock', label: 'Production', icon: 'chart', route: '/production' },
    { group: 'Resources', label: 'Inventory', icon: 'box', route: '/inventory' },
    { group: 'Resources', label: 'Stock movements', icon: 'refresh', route: '/movements' },
    { group: 'Resources', label: 'Suppliers', icon: 'group', route: '/suppliers' },
    { group: 'Resources', label: 'Stock locations', icon: 'home', route: '/locations' },
    { group: 'Resources', label: 'Tasks', icon: 'checklist', route: '/tasks' },
    { group: 'Resources', label: 'Equipment', icon: 'toolbox', route: '/equipment' },
    { group: 'Resources', label: 'Maintenance', icon: 'preferences', route: '/maintenance' },
    { group: 'Finance', label: 'Finance', icon: 'money', route: '/finance' },
    { group: 'Information', label: 'Reports', icon: 'chart', route: '/reports' },
    { group: 'Information', label: 'Documents', icon: 'file', route: '/documents' },
    { group: 'Administration', label: 'Audit history', icon: 'clock', route: '/audit' },
    { group: 'Administration', label: 'Settings', icon: 'preferences', route: '/settings' },
    { group: 'Administration', label: 'System admin', icon: 'user', route: '/admin', adminOnly: true },
    { group: 'Administration', label: 'Functional coverage', icon: 'bulletlist', route: '/coverage' },
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
