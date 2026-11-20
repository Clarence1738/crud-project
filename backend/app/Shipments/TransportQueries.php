<?php

namespace App\Shipments;

use App\Models\Transport;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TransportQueries
{
    public function page(int $userId, array $filters): array
    {
        $today = now('Africa/Nairobi')->toDateString();
        $owned = Transport::where('user_id', $userId);
        $counts = (clone $owned)->where('status', '!=', 'Delivered')->toBase()
            ->selectRaw('COUNT(CASE WHEN expected_arrival_date = ? THEN 1 END) AS due_today,
                COUNT(CASE WHEN expected_arrival_date < ? THEN 1 END) AS overdue,
                COUNT(CASE WHEN expected_arrival_date IS NULL THEN 1 END) AS missing_eta', [$today, $today])
            ->first();

        $search = $filters['search'] ?? null;
        if ($search !== null && $search !== '') {
            $pattern = '%'.$search.'%';
            $owned->where(function ($query) use ($pattern): void {
                $query->whereLike('sender_company', $pattern)
                    ->orWhereLike('recipient_company', $pattern)
                    ->orWhereLike('customer', $pattern)
                    ->orWhereLike('reference', $pattern)
                    ->orWhereLike('goods_description', $pattern)
                    ->orWhereLike('origin', $pattern)
                    ->orWhereLike('destination', $pattern)
                    ->orWhereLike('vehicle', $pattern);
            });
        }
        if ($status = $filters['status'] ?? null) {
            $owned->where('status', $status);
        }
        if ($exception = $filters['exception'] ?? null) {
            $owned->where('status', '!=', 'Delivered');
            match ($exception) {
                'due_today' => $owned->where('expected_arrival_date', $today),
                'overdue' => $owned->where('expected_arrival_date', '<', $today),
                'missing_eta' => $owned->whereNull('expected_arrival_date'),
            };
        }
        $page = $owned->latest()->orderBy('id')->paginate(50)->withQueryString();

        return [...$page->toArray(), 'exceptions' => $counts];
    }

    public function calendar(int $userId, string $start, string $end): Collection
    {
        return Transport::where('user_id', $userId)
            ->whereBetween('expected_arrival_date', [$start, $end])
            ->orderBy('expected_arrival_date')->orderBy('id')
            ->get(['id', 'customer', 'recipient_company', 'reference', 'expected_arrival_date', 'status']);
    }

    public function history(Transport $transport): Collection
    {
        return DB::table('transport_status_events')->where('transport_id', $transport->id)
            ->orderByDesc('id')->get(['status', 'changed_at'])
            ->map(fn ($event) => [
                'status' => $event->status,
                'changed_at' => CarbonImmutable::parse($event->changed_at, config('app.timezone'))->toISOString(),
            ]);
    }
}
