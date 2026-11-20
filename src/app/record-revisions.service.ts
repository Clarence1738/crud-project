import { DOCUMENT } from '@angular/common';
import { afterNextRender, computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

interface RecordRevisions {
  transports: string;
  documents: string;
  date: string;
}

@Injectable({ providedIn: 'root' })
export class RecordRevisionsService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snapshot = signal<{ user: string; revisions: RecordRevisions } | null>(null);
  private readonly current = computed(() => {
    const snapshot = this.snapshot();
    return snapshot?.user === this.auth.user() ? snapshot.revisions : null;
  });
  readonly transports = computed(() => this.current()?.transports ?? null);
  readonly register = computed(() => {
    const current = this.current();
    return current ? current.transports + ':' + current.date : null;
  });
  readonly documents = computed(() => this.current()?.documents ?? null);

  constructor() {
    afterNextRender(() => {
      const timer = setInterval(() => void this.check(), 10_000);
      this.document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.destroyRef.onDestroy(() => {
        clearInterval(timer);
        this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
      });
    });
  }

  private checking = false;
  private readonly onVisibilityChange = () => void this.check();

  private async check(): Promise<void> {
    const user = this.auth.user();
    if (!user) this.snapshot.set(null);
    if (!user || this.document.visibilityState === 'hidden' || this.checking) return;

    this.checking = true;
    try {
      const revisions = await this.api.request<RecordRevisions>('GET', 'record-revisions');
      if (!this.destroyRef.destroyed && user === this.auth.user()) {
        this.snapshot.set({ user, revisions });
      }
    } catch {
      // Try again on the next poll. ApiService handles expired sessions.
    } finally {
      this.checking = false;
    }
  }
}
