<?php

namespace App\Http\Controllers;

use App\Http\Requests\TransportRequest;
use App\Models\Transport;
use App\Shipments\DeliveryAnalytics;
use App\Shipments\TransportQueries;
use App\Shipments\TransportStatusService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class TransportController extends Controller
{
    public function __construct(
        private readonly TransportQueries $queries,
        private readonly TransportStatusService $statuses,
    ) {}

    public function index_transports(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:Scheduled,In transit,Delivered'],
            'exception' => ['nullable', 'in:due_today,overdue,missing_eta'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        return response()->json($this->queries->page($request->user()->id, $filters));
    }

    public function calendar(Request $request): JsonResponse
    {
        $range = $request->validate([
            'start' => ['required', 'date_format:Y-m-d'],
            'end' => ['required', 'date_format:Y-m-d', 'after_or_equal:start'],
        ]);
        abort_if($range['end'] > CarbonImmutable::parse($range['start'])->addDays(62)->toDateString(), 422);

        return response()->json(['data' => $this->queries->calendar($request->user()->id, $range['start'], $range['end'])]);
    }

    public function analytics(Request $request, DeliveryAnalytics $analytics): JsonResponse
    {
        return response()->json(['data' => $analytics->forAccount($request->user()->id)]);
    }

    public function store_transport(TransportRequest $request): JsonResponse
    {
        $transport = $this->statuses->create($request->user()->id, $request->validated());

        return response()->json(['data' => $transport], 201);
    }

    public function show_transport(Transport $transport): JsonResponse
    {
        Gate::authorize('view', $transport);

        $departure = CarbonImmutable::parse($transport->date, 'Africa/Nairobi');
        $end = $transport->status === 'Delivered'
            ? $transport->delivered_at?->toImmutable()->setTimezone('Africa/Nairobi')->startOfDay()
            : CarbonImmutable::today('Africa/Nairobi');

        return response()->json(['data' => [
            ...$transport->toArray(),
            'transit_days' => $end !== null && $end->greaterThanOrEqualTo($departure)
                ? (int) $departure->diffInDays($end)
                : null,
            'history' => $this->queries->history($transport),
        ]]);
    }

    public function update_transport(TransportRequest $request, Transport $transport): JsonResponse
    {
        Gate::authorize('update', $transport);
        $transport = $this->statuses->update($transport, $request->validated());

        return response()->json(['data' => $transport]);
    }

    public function update_transport_status(Request $request, Transport $transport): JsonResponse
    {
        Gate::authorize('update', $transport);
        $validated = $request->validate([
            'status' => ['required', 'in:Scheduled,In transit,Delivered'],
            'user_id' => ['prohibited'],
        ]);
        $transport = $this->statuses->update($transport, $validated);

        return response()->json(['data' => $transport]);
    }

    public function destroy_transport(Transport $transport): Response
    {
        Gate::authorize('delete', $transport);
        $transport->delete();

        return response()->noContent();
    }
}
