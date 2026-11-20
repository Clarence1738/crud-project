<?php

namespace Tests\Feature;

use App\Models\Transport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_shipment_details_count_days_until_delivery_and_ignore_future_departures(): void
    {
        $owner = User::factory()->create();
        $this->travelTo(now()->setDate(2026, 11, 20)->setTime(20, 0));
        $shipment = [
            'sender_company' => 'Sender', 'recipient_company' => 'Recipient',
            'origin' => 'Nairobi', 'destination' => 'Mombasa', 'vehicle' => 'KDA 123A',
            'date' => '2026-11-20', 'status' => 'In transit',
        ];
        $id = $this->actingAs($owner)->postJson('/api/transports', $shipment)
            ->assertCreated()->json('data.id');
        $url = '/api/transports/'.$id;
        $this->getJson($url)->assertJsonPath('data.transit_days', 0);
        $this->travel(2)->hours();
        $this->getJson($url)->assertJsonPath('data.transit_days', 1);
        $this->patchJson($url.'/status', ['status' => 'Delivered'])->assertOk();
        $this->travel(2)->days();
        $this->getJson($url)->assertJsonPath('data.transit_days', 1);
        $future = $this->postJson('/api/transports', [
            ...$shipment, 'date' => '2026-11-25', 'status' => 'Delivered',
        ])->assertCreated()->json('data.id');
        $this->getJson('/api/transports/'.$future)->assertJsonPath('data.transit_days', null);
        $this->getJson('/api/transports/analytics')->assertJsonPath('data.transit.excluded', 1)
            ->assertJsonPath('data.transit.median_days', 1);
    }

    public function test_delivery_metrics_preserve_the_baseline_and_count_only_the_latest_completed_cycle(): void
    {
        $url = '/api/transports/analytics';
        $this->getJson($url)->assertUnauthorized();
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($owner)->getJson($url)->assertOk()
            ->assertJsonPath('data.on_time.rate', null)
            ->assertJsonPath('data.transit.median_days', null);

        $shipment = [
            'sender_company' => 'Sender', 'recipient_company' => 'Recipient',
            'origin' => 'Nairobi', 'destination' => 'Mombasa', 'vehicle' => 'KDA 123A',
            'date' => '2026-11-18', 'expected_arrival_date' => '2026-11-20', 'status' => 'Scheduled',
        ];
        $this->travelTo(now()->setDate(2026, 11, 20)->setTime(15, 0));
        $id = $this->postJson('/api/transports', $shipment)->assertCreated()
            ->assertJsonPath('data.promised_arrival_date', '2026-11-20')->json('data.id');
        $this->putJson('/api/transports/'.$id, [...$shipment, 'expected_arrival_date' => '2026-11-22'])
            ->assertOk()->assertJsonPath('data.promised_arrival_date', '2026-11-20');
        $status = fn (string $id, string $status) => $this->patchJson('/api/transports/'.$id.'/status', ['status' => $status])->assertOk();
        $status($id, 'In transit');
        $this->travel(4)->hours();
        $status($id, 'Delivered');
        $this->getJson($url)->assertJsonPath('data.on_time.count', 1)
            ->assertJsonPath('data.transit.median_days', 2);

        $status($id, 'Scheduled');
        $this->getJson($url)->assertJsonPath('data.delivered', 0);
        $this->travel(1)->hour();
        $status($id, 'In transit');
        $this->travel(2)->hours(); // Local date is now 21 November.
        $status($id, 'Delivered');
        $this->getJson($url)->assertJsonPath('data.on_time.count', 0)
            ->assertJsonPath('data.transit.median_days', 3);

        $second = $this->postJson('/api/transports', [...$shipment, 'date' => '2026-11-21', 'expected_arrival_date' => null])
            ->assertCreated()->json('data.id');
        $status($second, 'In transit');
        $this->travel(30)->minutes();
        $status($second, 'Delivered');

        $this->postJson('/api/transports', [...$shipment, 'date' => '2026-11-19', 'status' => 'Delivered'])->assertCreated();
        $record = new Transport([...$shipment, 'customer' => 'Recipient', 'status' => 'Delivered']);
        $record->user_id = $owner->id;
        $record->save();
        $this->actingAs($other)->postJson('/api/transports', [...$shipment, 'status' => 'Delivered'])->assertCreated();

        $this->actingAs($owner)->getJson($url)->assertOk()
            ->assertJsonPath('data.delivered', 4)
            ->assertJsonPath('data.on_time.eligible', 2)
            ->assertJsonPath('data.on_time.missing_delivery_date', 1)
            ->assertJsonPath('data.on_time.missing_promised_date', 1)
            ->assertJsonPath('data.on_time.baseline_coverage', 2 / 3)
            ->assertJsonPath('data.transit.eligible', 3)
            ->assertJsonPath('data.transit.excluded', 1)
            ->assertJsonPath('data.transit.median_days', 2)
            ->assertJsonPath('data.transit.p90_days', 3);
    }
}
