<?php

namespace App\Shipments;

use Illuminate\Support\Facades\DB;

class DeliveryAnalytics
{
    public function forAccount(int $userId): array
    {
        // Shipment and event timestamps are stored in UTC. Nairobi uses UTC+03.
        $postgres = DB::getDriverName() === 'pgsql';
        $deliveryDate = $postgres
            ? "CAST((delivered_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi' AS date)"
            : "date(delivered_at, '+3 hours')";
        $duration = $postgres
            ? 'delivery_date - departure_date'
            : 'julianday(delivery_date) - julianday(departure_date)';

        $metrics = DB::selectOne(<<<SQL
            WITH delivered AS (
                SELECT date AS departure_date, {$deliveryDate} AS delivery_date, promised_arrival_date
                FROM transports
                WHERE user_id = ? AND status = 'Delivered'
            ), intervals AS (
                SELECT {$duration} AS days FROM delivered WHERE delivery_date >= departure_date
            ), ranked AS (
                SELECT days, ROW_NUMBER() OVER (ORDER BY days) AS position,
                    COUNT(*) OVER () AS sample_size
                FROM intervals
            )
            SELECT COUNT(*) AS delivered_count,
                COUNT(delivery_date) AS dated_count,
                COUNT(CASE WHEN delivery_date IS NOT NULL AND promised_arrival_date IS NOT NULL THEN 1 END) AS eligible_count,
                COUNT(CASE WHEN delivery_date <= promised_arrival_date THEN 1 END) AS on_time_count,
                (SELECT COUNT(*) FROM ranked) AS transit_count,
                (SELECT AVG(days) FROM ranked WHERE position IN ((sample_size + 1) / 2, (sample_size + 2) / 2)) AS median_days,
                (SELECT MAX(days) FROM ranked WHERE position = (sample_size * 9 + 9) / 10) AS p90_days
            FROM delivered
            SQL, [$userId]);

        $delivered = (int) $metrics->delivered_count;
        $dated = (int) $metrics->dated_count;
        $eligible = (int) $metrics->eligible_count;
        $onTime = (int) $metrics->on_time_count;
        $transit = (int) $metrics->transit_count;

        return [
            'delivered' => $delivered,
            'on_time' => [
                'count' => $onTime,
                'eligible' => $eligible,
                'missing_delivery_date' => $delivered - $dated,
                'missing_promised_date' => $dated - $eligible,
                'rate' => $eligible ? $onTime / $eligible : null,
                'baseline_coverage' => $dated ? $eligible / $dated : null,
            ],
            'transit' => [
                'eligible' => $transit,
                'excluded' => $delivered - $transit,
                'median_days' => $metrics->median_days === null ? null : (float) $metrics->median_days,
                'p90_days' => $metrics->p90_days === null ? null : (int) $metrics->p90_days,
            ],
        ];
    }
}
