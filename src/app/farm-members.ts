import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from './api.service';
import { AuthService } from './auth.service';
import { Farm, farmCan, FarmInvitation, FarmMember, FarmRole, FarmService } from './farm.service';

/** Farm members, roles, and invitation codes for the active farm. */
@Component({
  selector: 'app-farm-members',
  imports: [FormsModule],
  templateUrl: './farm-members.html',
  styleUrl: './farm-collab.css',
})
export class FarmMembers {
  private readonly service = inject(FarmService);
  private readonly auth = inject(AuthService);
  readonly farm = input.required<Farm>();
  /** Emits the joined farm, or null after the user leaves the active farm. */
  readonly membershipChanged = output<Farm | null>();
  readonly members = signal<FarmMember[]>([]);
  readonly invitations = signal<FarmInvitation[]>([]);
  readonly issued = signal<FarmInvitation | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly isOwner = computed(() => farmCan.manageFarm(this.farm().role));
  readonly userId = this.auth.userId;
  readonly roles: FarmRole[] = ['Manager', 'Worker'];
  inviteEmail = '';
  inviteRole: FarmRole = 'Worker';
  joinCode = '';

  constructor() {
    effect(() => {
      const farm = this.farm();
      this.issued.set(null);
      void this.load(farm);
    });
  }

  private async load(farm: Farm): Promise<void> {
    await this.run(async () => {
      const [members, invitations] = await Promise.all([
        this.service.members(farm.id),
        farmCan.manageFarm(farm.role) ? this.service.invitations(farm.id) : Promise.resolve([]),
      ]);
      this.members.set(members);
      this.invitations.set(invitations);
    });
  }

  async invite(): Promise<void> {
    const farm = this.farm();
    await this.run(async () => {
      this.issued.set(await this.service.invite(farm.id, this.inviteEmail, this.inviteRole));
      this.inviteEmail = '';
      this.invitations.set(await this.service.invitations(farm.id));
    });
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.notice.set('Invitation code copied.');
    } catch {
      this.notice.set('Copy the code manually.');
    }
  }

  async revoke(invitation: FarmInvitation): Promise<void> {
    if (!confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    const farm = this.farm();
    await this.run(async () => {
      await this.service.revokeInvitation(farm.id, invitation.id);
      if (this.issued()?.id === invitation.id) this.issued.set(null);
      this.invitations.set(await this.service.invitations(farm.id));
    });
  }

  async changeRole(member: FarmMember, role: FarmRole): Promise<void> {
    const farm = this.farm();
    await this.run(async () => {
      await this.service.updateMemberRole(farm.id, member.id, role);
      this.members.set(await this.service.members(farm.id));
    });
  }

  async remove(member: FarmMember): Promise<void> {
    const self = member.id === this.userId();
    const question = self
      ? `Leave ${this.farm().name}? You will lose access until you are invited again.`
      : `Remove ${member.name} from ${this.farm().name}? Their assigned tasks become unassigned.`;
    if (!confirm(question)) return;
    const farm = this.farm();
    await this.run(async () => {
      await this.service.removeMember(farm.id, member.id);
      if (self) this.membershipChanged.emit(null);
      else this.members.set(await this.service.members(farm.id));
    });
  }

  async join(): Promise<void> {
    await this.run(async () => {
      const farm = await this.service.acceptInvitation(this.joinCode);
      this.joinCode = '';
      this.notice.set(`You joined ${farm.name} as ${farm.role}.`);
      this.membershipChanged.emit(farm);
    });
  }

  private async run(task: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await task();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
