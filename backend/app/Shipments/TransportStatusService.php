<?php

namespace App\Shipments;

use App\Models\Transport;
use Illuminate\Support\Facades\DB;

class TransportStatusService
{
    public function create(int $userId, array $attributes): Transport
    {
        $transport = new Transport($attributes);
        $transport->customer ??= $transport->recipient_company;
        $transport->user_id = $userId;
        DB::transaction(fn () => $this->save($transport));

        return $transport;
    }

    public function update(Transport $transport, array $attributes): Transport
    {
        return DB::transaction(function () use ($transport, $attributes): Transport {
            $locked = Transport::whereKey($transport->id)->lockForUpdate()->firstOrFail();
            $locked->fill($attributes);
            $this->save($locked);

            return $locked;
        });
    }

    private function save(Transport $transport): void
    {
        if ($transport->promised_arrival_date === null && $transport->expected_arrival_date !== null) {
            $firstEta = ! $transport->exists || (
                $transport->getOriginal('expected_arrival_date') === null
                && $transport->getOriginal('status') !== 'Delivered'
                && ! DB::table('transport_status_events')->where('transport_id', $transport->id)
                    ->where('status', 'Delivered')->exists()
            );
            if ($firstEta) {
                $transport->promised_arrival_date = $transport->expected_arrival_date;
            }
        }
        $statusChanged = ! $transport->exists || $transport->isDirty('status');
        $changedAt = now();
        if ($statusChanged) {
            $transport->delivered_at = $transport->status === 'Delivered' ? $changedAt : null;
        }
        $transport->save();
        if ($statusChanged) {
            DB::table('transport_status_events')->insert([
                'transport_id' => $transport->id,
                'status' => $transport->status,
                'changed_at' => $changedAt,
            ]);
        }
    }
}
