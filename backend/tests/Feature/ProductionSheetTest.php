<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductionSheetTest extends TestCase
{
    use RefreshDatabase;

    private function farmWithCows(User $owner): array
    {
        $farm = $this->actingAs($owner)->postJson('/api/farms', ['name' => 'Dairy Farm', 'county' => 'Nakuru'])->assertCreated()->json('data.id');
        $cows = [];
        foreach (['KE-001', 'KE-002'] as $tag) {
            $cows[] = $this->postJson("/api/farms/{$farm}/livestock", ['tracking_type' => 'Individual', 'tag_number' => $tag, 'species' => 'Dairy cattle', 'sex' => 'Female', 'quantity' => 1, 'status' => 'Active'])
                ->assertCreated()->json('data.id');
        }

        return [$farm, $cows];
    }

    private function today(int $minusDays = 0): string
    {
        return CarbonImmutable::now('Africa/Nairobi')->subDays($minusDays)->toDateString();
    }

    public function test_a_sheet_records_morning_and_evening_milk_and_feeds_the_summary(): void
    {
        $owner = User::factory()->create();
        [$farm, [$a, $b]] = $this->farmWithCows($owner);
        $slot = ['measured_on' => $this->today(), 'kind' => 'Milk'];

        $this->postJson("/api/farms/{$farm}/production/sheet", [...$slot, 'session' => 'Morning', 'entries' => [
            ['livestock_record_id' => $a, 'value' => 12.5], ['livestock_record_id' => $b, 'value' => null],
        ]])->assertOk()->assertJsonPath('data.saved', 1)->assertJsonPath('data.unit', 'litres');
        $this->postJson("/api/farms/{$farm}/production/sheet", [...$slot, 'session' => 'Evening', 'entries' => [
            ['livestock_record_id' => $a, 'value' => 9], ['livestock_record_id' => $b, 'value' => 10],
        ]])->assertOk()->assertJsonPath('data.saved', 2);

        $sheet = $this->getJson("/api/farms/{$farm}/production/sheet?".http_build_query([...$slot, 'session' => 'Morning']))->assertOk()->json('data');
        $this->assertEquals([12.5, null], array_column($sheet, 'value'));

        $this->postJson("/api/farms/{$farm}/production/sheet", [...$slot, 'session' => 'Morning', 'entries' => [['livestock_record_id' => $a, 'value' => 13]]])
            ->assertOk()->assertJsonPath('data.corrected', 1);
        $this->assertSame(3, DB::table('livestock_measurements')->where('farm_id', $farm)->count());

        $milk = $this->getJson("/api/farms/{$farm}/production/summary")->assertOk()->json('data.kinds.0');
        $this->assertSame('Milk', $milk['kind']);
        $this->assertCount(14, $milk['series']);
        $this->assertEquals(32, $milk['today']);
        $this->assertEquals(13, end($milk['series'])['Morning']);
        $this->assertEquals(19, end($milk['series'])['Evening']);
        $this->assertTrue(DB::table('audit_events')->where('record_type', 'Production sheet')->exists());

        $goat = $this->postJson("/api/farms/{$farm}/livestock", ['tracking_type' => 'Individual', 'tag_number' => 'GT-01', 'species' => 'Goats', 'sex' => 'Female', 'quantity' => 1, 'status' => 'Active'])
            ->assertCreated()->json('data.id');
        $this->postJson("/api/farms/{$farm}/production/sheet", [...$slot, 'session' => 'Evening', 'entries' => [['livestock_record_id' => $goat, 'value' => 2.5]]])->assertOk();
        $milk = $this->getJson("/api/farms/{$farm}/production/summary")->assertOk()->json('data.kinds.0');
        $this->assertSame(['Dairy cattle', 'Goats'], $milk['species']);
        $this->assertEquals(32, end($milk['series'])['species:Dairy cattle']);
        $this->assertEquals(2.5, end($milk['series'])['species:Goats']);
        $this->assertEquals(['Dairy cattle' => 32, 'Goats' => 2.5], array_column($milk['by_species'], 'today', 'species'));

        // Yesterday's morning only: today's morning (13 + 0) and evening are compared with it alone.
        $this->postJson("/api/farms/{$farm}/production/sheet", ['measured_on' => $this->today(1), 'kind' => 'Milk', 'session' => 'Morning', 'entries' => [
            ['livestock_record_id' => $a, 'value' => 10], ['livestock_record_id' => $b, 'value' => 6],
        ]])->assertOk();
        $compare = collect($this->getJson("/api/farms/{$farm}/production/summary")->json('data.kinds.0.compare'))->keyBy(fn ($c) => $c['species'] ?? 'All');
        $this->assertEquals(32, $compare['Dairy cattle']['today']);
        $this->assertEquals(16, $compare['Dairy cattle']['yesterday']);
        $this->assertEquals(16, $compare['Dairy cattle']['yesterday_same_sessions']);
        $this->assertEquals(100, $compare['Dairy cattle']['change_percent']);
        $this->assertSame([2, 2, 2], [$compare['Dairy cattle']['animals_today'], $compare['Dairy cattle']['animals_yesterday'], $compare['Dairy cattle']['animals_active']]);
        $this->assertEquals(8, $compare['Dairy cattle']['per_animal_yesterday']);
        $this->assertEquals(2.5, $compare['Goats']['today']);
        $this->assertNull($compare['Goats']['change_percent']);
        $this->assertEquals(34.5, $compare['All']['today']);
        $this->assertSame(3, $compare['All']['animals_active']);
    }

    public function test_eggs_are_counted_in_whole_eggs_and_the_unit_follows_the_measure(): void
    {
        $owner = User::factory()->create();
        [$farm] = $this->farmWithCows($owner);
        $hens = $this->postJson("/api/farms/{$farm}/livestock", ['tracking_type' => 'Group', 'group_name' => 'Layers', 'species' => 'Poultry', 'sex' => 'Female', 'quantity' => 100, 'status' => 'Active'])
            ->assertCreated()->json('data.id');
        $sheet = ['measured_on' => $this->today(), 'session' => 'Whole day', 'kind' => 'Eggs'];

        $this->postJson("/api/farms/{$farm}/production/sheet", [...$sheet, 'entries' => [['livestock_record_id' => $hens, 'value' => 84.5]]])->assertStatus(422);
        $this->postJson("/api/farms/{$farm}/production/sheet", [...$sheet, 'entries' => [['livestock_record_id' => $hens, 'value' => 84]]])
            ->assertOk()->assertJsonPath('data.unit', 'eggs');

        // The single form sends no unit; a wrong one is ignored.
        $this->postJson("/api/farms/{$farm}/operations/production", ['livestock_record_id' => $hens, 'measured_on' => $this->today(1), 'kind' => 'Eggs', 'value' => 90, 'unit' => 'kg'])
            ->assertCreated()->assertJsonPath('data.unit', 'eggs');
        $this->postJson("/api/farms/{$farm}/operations/production", ['livestock_record_id' => $hens, 'measured_on' => $this->today(1), 'kind' => 'Eggs', 'value' => 1.5])
            ->assertStatus(422);

        // A flock of 100 counts as one record but 100 hens: 90 eggs is 0.9 per hen.
        $eggs = $this->getJson("/api/farms/{$farm}/production/summary")->assertOk()->json('data.kinds.0');
        $this->assertSame(['Eggs', 'eggs'], [$eggs['kind'], $eggs['unit']]);
        $this->assertSame([1, 1], [$eggs['compare'][0]['animals_yesterday'], $eggs['compare'][0]['animals_active']]);
        $this->assertEquals(0.9, $eggs['compare'][0]['per_animal_yesterday']);
    }

    public function test_a_day_is_either_a_whole_day_total_or_sessions_never_both(): void
    {
        $owner = User::factory()->create();
        [$farm, [$a, $b]] = $this->farmWithCows($owner);
        $day = ['measured_on' => $this->today(), 'kind' => 'Milk'];

        // Morning alone is fine; evening is optional.
        $this->postJson("/api/farms/{$farm}/production/sheet", [...$day, 'session' => 'Morning', 'entries' => [['livestock_record_id' => $a, 'value' => 10]]])->assertOk();
        // Cow A has a session, so a whole-day total for A is refused; cow B can still have one.
        $this->postJson("/api/farms/{$farm}/production/sheet", [...$day, 'session' => 'Whole day', 'entries' => [['livestock_record_id' => $a, 'value' => 20]]])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'KE-001') && str_contains($m, 'by session'));
        $this->postJson("/api/farms/{$farm}/production/sheet", [...$day, 'session' => 'Whole day', 'entries' => [['livestock_record_id' => $b, 'value' => 20]]])->assertOk();
        // Cow B has a whole-day total, so no sessions for B, from the sheet or the single form.
        $this->postJson("/api/farms/{$farm}/production/sheet", [...$day, 'session' => 'Evening', 'entries' => [['livestock_record_id' => $b, 'value' => 8]]])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'whole-day'));
        $this->postJson("/api/farms/{$farm}/operations/production", [...$day, 'livestock_record_id' => $b, 'session' => 'Morning', 'value' => 8])->assertStatus(422);
        // A's evening is still allowed alongside its morning.
        $this->postJson("/api/farms/{$farm}/operations/production", [...$day, 'livestock_record_id' => $a, 'session' => 'Evening', 'value' => 8])->assertCreated();

        $sheet = collect($this->getJson("/api/farms/{$farm}/production/sheet?".http_build_query([...$day, 'session' => 'Whole day']))->json('data'))->keyBy('id');
        $this->assertSame(['Morning', 'Evening'], $sheet[$a]['blocked_by']);
        $this->assertNull($sheet[$b]['blocked_by']);
        $sheet = collect($this->getJson("/api/farms/{$farm}/production/sheet?".http_build_query([...$day, 'session' => 'Morning']))->json('data'))->keyBy('id');
        $this->assertSame(['Whole day'], $sheet[$b]['blocked_by']);
    }

    public function test_owners_and_managers_can_delete_a_produce_entry(): void
    {
        $owner = User::factory()->create();
        [$farm, [$a]] = $this->farmWithCows($owner);
        $entry = $this->postJson("/api/farms/{$farm}/operations/production", ['livestock_record_id' => $a, 'measured_on' => $this->today(), 'session' => 'Morning', 'kind' => 'Milk', 'value' => 12])
            ->assertCreated()->json('data.id');
        $field = $this->postJson("/api/farms/{$farm}/operations/fields", ['name' => 'North', 'size_hectares' => 2, 'status' => 'In use'])->json('data.id');
        $worker = User::factory()->create();
        $code = $this->postJson("/api/farms/{$farm}/invitations", ['email' => $worker->email, 'role' => 'Worker'])->json('data.code');
        $this->actingAs($worker)->postJson('/api/farm-invitations/accept', ['code' => $code])->assertOk();

        $this->deleteJson("/api/farms/{$farm}/operations/production/{$entry}")->assertForbidden();
        $this->actingAs($owner)->deleteJson("/api/farms/{$farm}/operations/fields/{$field}")->assertStatus(405);
        $this->deleteJson("/api/farms/{$farm}/operations/production/{$entry}")->assertNoContent();
        $this->deleteJson("/api/farms/{$farm}/operations/production/{$entry}")->assertNotFound();
        $this->assertSame(0, DB::table('livestock_measurements')->where('farm_id', $farm)->count());
        $this->assertTrue(DB::table('audit_events')->where('action', 'Deleted')->where('record_type', 'Measurement')->exists());
    }

    public function test_workers_record_but_cannot_overwrite_and_outsiders_are_kept_out(): void
    {
        $owner = User::factory()->create();
        [$farm, [$a]] = $this->farmWithCows($owner);
        $worker = User::factory()->create();
        $code = $this->postJson("/api/farms/{$farm}/invitations", ['email' => $worker->email, 'role' => 'Worker'])->json('data.code');
        $this->actingAs($worker)->postJson('/api/farm-invitations/accept', ['code' => $code])->assertOk();
        $sheet = ['measured_on' => $this->today(1), 'session' => 'Morning', 'kind' => 'Milk'];

        $this->postJson("/api/farms/{$farm}/production/sheet", [...$sheet, 'entries' => [['livestock_record_id' => $a, 'value' => 11]]])->assertOk();
        $this->postJson("/api/farms/{$farm}/production/sheet", [...$sheet, 'entries' => [['livestock_record_id' => $a, 'value' => 11]]])->assertOk();
        $this->postJson("/api/farms/{$farm}/production/sheet", [...$sheet, 'entries' => [['livestock_record_id' => $a, 'value' => 15]]])->assertForbidden();
        $this->postJson("/api/farms/{$farm}/production/sheet", [...$sheet, 'measured_on' => $this->today(-2), 'entries' => [['livestock_record_id' => $a, 'value' => 5]]])->assertStatus(422);

        $outsider = User::factory()->create();
        $this->actingAs($outsider)->getJson("/api/farms/{$farm}/production/summary")->assertNotFound();
        [$other] = $this->farmWithCows($outsider);
        $this->postJson("/api/farms/{$other}/production/sheet", [...$sheet, 'entries' => [['livestock_record_id' => $a, 'value' => 5]]])->assertStatus(422);
    }
}
