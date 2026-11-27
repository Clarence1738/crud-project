<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FarmRecordModulesTest extends TestCase
{
    use RefreshDatabase;

    private function farm(User $owner): array
    {
        $farm = $this->actingAs($owner)->postJson('/api/farms', ['name' => 'Green Valley Farm', 'county' => 'Nakuru', 'size_hectares' => 20])
            ->assertCreated()->json('data.id');
        $field = $this->postJson("/api/farms/{$farm}/operations/fields", ['name' => 'North Field', 'size_hectares' => 6, 'status' => 'In use'])
            ->assertCreated()->json('data.id');
        $crop = $this->postJson("/api/farms/{$farm}/crops", ['crop' => 'Maize', 'field_id' => $field, 'area_hectares' => 4, 'status' => 'Active'])
            ->assertCreated()->json('data.id');
        $cow = $this->postJson("/api/farms/{$farm}/livestock", ['tracking_type' => 'Individual', 'tag_number' => 'KE-001', 'species' => 'Dairy cattle', 'quantity' => 1, 'status' => 'Active'])
            ->assertCreated()->json('data.id');

        return [$farm, $crop, $cow];
    }

    private function join(User $owner, string $farm, User $invitee, string $role): void
    {
        $code = $this->actingAs($owner)->postJson("/api/farms/{$farm}/invitations", ['email' => $invitee->email, 'role' => $role])->json('data.code');
        $this->actingAs($invitee)->postJson('/api/farm-invitations/accept', ['code' => $code])->assertOk();
    }

    public function test_harvests_update_the_season_total_and_incidents_are_recorded(): void
    {
        $owner = User::factory()->create();
        [$farm, $crop] = $this->farm($owner);
        $this->postJson("/api/farms/{$farm}/operations/locations", ['name' => 'Main store', 'kind' => 'Store'])->assertCreated();

        $harvest = $this->postJson("/api/farms/{$farm}/operations/harvests", [
            'crop_season_id' => $crop, 'harvest_date' => '2026-11-20', 'quantity_kg' => 1200, 'loss_kg' => 50,
            'grade' => 'Grade 1', 'destination' => 'Store', 'storage_location' => 'Main store',
        ])->assertCreated()->assertJsonPath('data.crop_label', 'Maize · North Field')->json('data.id');
        $this->assertEquals(1200, (float) DB::table('crop_seasons')->where('id', $crop)->value('harvested_kg'));

        $this->putJson("/api/farms/{$farm}/operations/harvests/{$harvest}", [
            'crop_season_id' => $crop, 'harvest_date' => '2026-11-20', 'quantity_kg' => 1000, 'grade' => 'Grade 2', 'destination' => 'Sold',
        ])->assertOk();
        $this->assertEquals(1000, (float) DB::table('crop_seasons')->where('id', $crop)->value('harvested_kg'));

        $this->postJson("/api/farms/{$farm}/operations/harvests", [
            'crop_season_id' => $crop, 'harvest_date' => '2026-11-20', 'quantity_kg' => 10, 'grade' => 'Grade 1', 'destination' => 'Store', 'storage_location' => 'Unknown shed',
        ])->assertStatus(422);
        $this->postJson("/api/farms/{$farm}/operations/incidents", [
            'crop_season_id' => $crop, 'type' => 'Pest', 'incident_date' => '2026-11-10', 'loss_kg' => 30, 'description' => 'Fall armyworm',
        ])->assertCreated()->assertJsonPath('data.loss_kg', fn ($v) => (float) $v === 30.0);
    }

    public function test_stock_movements_keep_the_balance_and_cannot_overdraw(): void
    {
        $owner = User::factory()->create();
        $worker = User::factory()->create();
        [$farm] = $this->farm($owner);
        $item = $this->postJson("/api/farms/{$farm}/operations/inventory", ['name' => 'DAP', 'category' => 'Fertilizer', 'unit' => 'kg', 'quantity' => 100, 'reorder_level' => 20])
            ->assertCreated()->json('data.id');
        $this->postJson("/api/farms/{$farm}/operations/suppliers", ['name' => 'Agrovet', 'kind' => 'Supplier'])->assertCreated();

        $this->postJson("/api/farms/{$farm}/operations/movements", ['inventory_item_id' => $item, 'type' => 'Receipt', 'quantity' => 50, 'moved_on' => '2026-11-01', 'supplier' => 'Agrovet'])
            ->assertCreated()->assertJsonPath('data.item_label', 'DAP')->assertJsonPath('data.balance_after', fn ($v) => (float) $v === 150.0);
        $movement = $this->postJson("/api/farms/{$farm}/operations/movements", ['inventory_item_id' => $item, 'type' => 'Issue', 'quantity' => 40, 'moved_on' => '2026-11-02'])
            ->assertCreated()->json('data.id');
        $this->postJson("/api/farms/{$farm}/operations/movements", ['inventory_item_id' => $item, 'type' => 'Issue', 'quantity' => 500, 'moved_on' => '2026-11-03'])
            ->assertStatus(422);
        $this->postJson("/api/farms/{$farm}/operations/movements", ['inventory_item_id' => $item, 'type' => 'Adjustment', 'quantity' => -5, 'moved_on' => '2026-11-04'])
            ->assertStatus(422); // a reason is required
        $this->postJson("/api/farms/{$farm}/operations/movements", ['inventory_item_id' => $item, 'type' => 'Adjustment', 'quantity' => -5, 'moved_on' => '2026-11-04', 'reason' => 'Count'])
            ->assertCreated();
        $this->assertEquals(105, (float) DB::table('inventory_items')->where('id', $item)->value('quantity'));
        $this->putJson("/api/farms/{$farm}/operations/movements/{$movement}", ['inventory_item_id' => $item, 'type' => 'Issue', 'quantity' => 1, 'moved_on' => '2026-11-02'])
            ->assertStatus(409);

        $this->join($owner, $farm, $worker, 'Worker');
        $this->actingAs($worker)->postJson("/api/farms/{$farm}/operations/movements", ['inventory_item_id' => $item, 'type' => 'Issue', 'quantity' => 5, 'moved_on' => '2026-11-05'])
            ->assertCreated();
        $this->postJson("/api/farms/{$farm}/operations/movements", ['inventory_item_id' => $item, 'type' => 'Adjustment', 'quantity' => 5, 'moved_on' => '2026-11-05', 'reason' => 'Found'])
            ->assertForbidden();
        $this->postJson("/api/farms/{$farm}/operations/suppliers", ['name' => 'Other', 'kind' => 'Buyer'])->assertForbidden();
    }

    public function test_livestock_breeding_births_production_and_maintenance(): void
    {
        $owner = User::factory()->create();
        [$farm, , $cow] = $this->farm($owner);

        $this->postJson("/api/farms/{$farm}/operations/breeding", ['female_id' => $cow, 'bred_on' => '2026-09-01', 'method' => 'Natural', 'pregnancy_result' => 'Confirmed', 'expected_birth_on' => '2027-06-10'])
            ->assertCreated()->assertJsonPath('data.animal_label', 'KE-001 · Dairy cattle');
        $this->postJson("/api/farms/{$farm}/operations/breeding", ['female_id' => $cow, 'bred_on' => '2026-09-01', 'method' => 'Natural', 'pregnancy_result' => 'Pending', 'expected_birth_on' => '2026-08-01'])
            ->assertStatus(422);
        $this->postJson("/api/farms/{$farm}/operations/births", ['dam_id' => $cow, 'born_on' => '2026-11-01', 'born_alive' => 1])->assertCreated();
        $this->postJson("/api/farms/{$farm}/operations/production", ['livestock_record_id' => $cow, 'measured_on' => '2026-11-20', 'kind' => 'Milk', 'value' => 18.5, 'unit' => 'litres'])->assertCreated();

        $tractor = $this->postJson("/api/farms/{$farm}/operations/equipment", ['name' => 'Tractor', 'category' => 'Tractor', 'status' => 'Operational'])->json('data.id');
        $this->postJson("/api/farms/{$farm}/operations/maintenance", ['farm_equipment_id' => $tractor, 'serviced_on' => '2026-11-01', 'work_done' => 'Oil and filters', 'cost_kes' => 18500, 'next_service_date' => '2027-02-01'])
            ->assertCreated()->assertJsonPath('data.equipment_label', 'Tractor');
        $this->assertSame('2027-02-01', substr((string) DB::table('farm_equipment')->where('id', $tractor)->value('next_service_date'), 0, 10));
    }

    public function test_records_of_another_farm_cannot_be_linked_or_read(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        [$farm, $crop, $cow] = $this->farm($owner);
        [$otherFarm] = $this->farm($other);

        $this->actingAs($other)->postJson("/api/farms/{$otherFarm}/operations/harvests", ['crop_season_id' => $crop, 'harvest_date' => '2026-11-20', 'quantity_kg' => 1, 'grade' => 'Grade 1', 'destination' => 'Store'])
            ->assertStatus(422);
        $this->postJson("/api/farms/{$otherFarm}/operations/breeding", ['female_id' => $cow, 'bred_on' => '2026-09-01', 'method' => 'Natural', 'pregnancy_result' => 'Pending'])
            ->assertStatus(422);
        $this->getJson("/api/farms/{$farm}/operations/harvests")->assertNotFound();
        $this->getJson("/api/farms/{$farm}/settings")->assertNotFound();
    }

    public function test_audit_history_is_owner_only_and_records_changes(): void
    {
        $owner = User::factory()->create(['name' => 'Farm Owner']);
        $manager = User::factory()->create();
        [$farm] = $this->farm($owner);
        $this->join($owner, $farm, $manager, 'Manager');

        $this->actingAs($manager)->getJson("/api/farms/{$farm}/operations/audit")->assertForbidden();
        $this->postJson("/api/farms/{$farm}/operations/audit", [])->assertStatus(405);
        $events = $this->actingAs($owner)->getJson("/api/farms/{$farm}/operations/audit")->assertOk()->json('data');
        $types = array_column($events, 'record_type');
        foreach (['Farm', 'Field', 'Crop season', 'Livestock', 'Membership'] as $type) {
            $this->assertContains($type, $types);
        }
        $this->assertSame('Farm Owner', collect($events)->firstWhere('record_type', 'Farm')['actor_name']);
    }

    public function test_settings_control_manager_finance_access(): void
    {
        $owner = User::factory()->create();
        $manager = User::factory()->create();
        [$farm] = $this->farm($owner);
        $this->join($owner, $farm, $manager, 'Manager');

        $this->actingAs($manager)->getJson("/api/farms/{$farm}/operations/finance")->assertForbidden();
        $this->getJson("/api/farms/{$farm}/settings")->assertOk()->assertJsonPath('data.reminder_days', 7);
        $this->putJson("/api/farms/{$farm}/settings", ['reminder_days' => 10, 'manager_finance_access' => true, 'season_start_month' => 'March'])->assertForbidden();
        $this->getJson('/api/farms')->assertJsonPath('data.0.finance_access', false);

        $this->actingAs($owner)->putJson("/api/farms/{$farm}/settings", ['reminder_days' => 10, 'manager_finance_access' => true, 'season_start_month' => 'March'])
            ->assertOk()->assertJsonPath('data.reminder_days', 10);
        $this->actingAs($manager)->getJson("/api/farms/{$farm}/operations/finance")->assertOk();
        $this->getJson('/api/farms')->assertJsonPath('data.0.finance_access', true);
        $this->getJson("/api/farms/{$farm}/operations/audit")->assertForbidden();
    }

    public function test_system_administrator_can_suspend_accounts(): void
    {
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        $user = User::factory()->create(['password' => 'Strong-Password-123!']);
        $this->artisan('farm:make-admin', ['email' => 'admin@example.com'])->assertSuccessful();

        $this->actingAs($user)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($admin->fresh())->getJson('/api/admin/users')->assertOk()->assertJsonCount(2, 'data');
        $this->patchJson("/api/admin/users/{$admin->id}/status", ['status' => 'Suspended'])->assertStatus(422);
        $this->patchJson("/api/admin/users/{$user->id}/status", ['status' => 'Suspended'])->assertOk()->assertJsonPath('data.status', 'Suspended');

        $this->actingAs($user->fresh())->getJson('/api/farms')->assertUnauthorized();
        auth()->forgetGuards();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Strong-Password-123!'])->assertStatus(422);
    }
}
