import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DxTemplateDirective } from 'devextreme-angular/core';
import { DxButtonComponent } from 'devextreme-angular/ui/button';
import { DxPopupComponent } from 'devextreme-angular/ui/popup';

import { DocumentRecord, DocumentService } from './document.service';
import { errorMessage } from '../api.service';

@Component({
  selector: 'app-documents',
  imports: [FormsModule, DxTemplateDirective, DxButtonComponent, DxPopupComponent],
  templateUrl: './documents.html',
  styleUrl: './documents.css',
})
export class Documents implements OnInit {
  private readonly service = inject(DocumentService);
  readonly records = signal<DocumentRecord[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly editing = signal<DocumentRecord | null>(null);
  readonly deleting = signal<DocumentRecord | null>(null);
  title = '';
  file: File | null = null;

  ngOnInit(): void {
    void this.load();
  }

  async load(page = this.page()): Promise<void> {
    this.busy.set(true);
    this.message.set('');
    try {
      const response = await this.service.list(page);
      this.records.set(response.data);
      this.page.set(response.current_page);
      this.lastPage.set(response.last_page);
    } catch (error) {
      this.message.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  chooseFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  edit(record: DocumentRecord): void {
    this.editing.set(record);
    this.title = record.title;
    this.file = null;
    this.message.set('');
  }

  cancel(input: HTMLInputElement): void {
    this.editing.set(null);
    this.title = '';
    this.file = null;
    input.value = '';
  }

  async save(input: HTMLInputElement): Promise<void> {
    if (this.busy() || !this.title.trim() || (!this.editing() && !this.file)) return;
    if (this.file && this.file.size > 10 * 1024 * 1024) {
      this.message.set('Choose a file smaller than 10 MB.');
      return;
    }
    this.busy.set(true);
    this.message.set('');
    try {
      await this.service.save(this.title.trim(), this.file, this.editing()?.id ?? null);
      this.cancel(input);
      await this.load(1);
    } catch (error) {
      this.message.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  confirmDelete(record: DocumentRecord): void {
    if (this.busy()) return;
    this.message.set('');
    this.deleting.set(record);
  }

  async remove(): Promise<void> {
    const record = this.deleting();
    if (!record || this.busy()) return;
    this.busy.set(true);
    try {
      await this.service.delete(record.id);
      this.deleting.set(null);
      if (this.editing()?.id === record.id) {
        this.editing.set(null);
        this.title = '';
        this.file = null;
      }
      await this.load(1);
    } catch (error) {
      this.message.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
