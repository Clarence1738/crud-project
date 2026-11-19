<?php

namespace App\Http\Controllers;

use App\Http\Requests\TransportRequest;
use App\Models\Transport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class TransportController extends Controller
{
    public function index_transports(Request $request): JsonResponse
    {
      return response()->json(Transport::where('user_id', $request->user()->id)->latest()->paginate(50));
    }

    public function store_transport(TransportRequest $request): JsonResponse
    {
        $transport = new Transport($request->validated());
        $transport->user_id = $request->user()->id;
        $transport->save();

        return response()->json(['data' => $transport], 201);
    }

    public function show_transport(Transport $transport): JsonResponse
    {
        Gate::authorize('view', $transport);

        return response()->json(['data' => $transport]);
    }

    public function update_transport(TransportRequest $request, Transport $transport): JsonResponse
    {
        Gate::authorize('update', $transport);
        $transport->update($request->validated());

        return response()->json(['data' => $transport]);
    }

    public function update_transport_status(Request $request, Transport $transport): JsonResponse
    {
        Gate::authorize('update', $transport);
        $validated = $request->validate([
            'status' => ['required', 'in:Scheduled,In transit,Delivered'],
            'user_id' => ['prohibited'],
        ]);
        $transport->update($validated);

        return response()->json(['data' => $transport]);
    }

    public function destroy_transport(Transport $transport): Response
    {
        Gate::authorize('delete', $transport);
        $transport->delete();

        return response()->noContent();
    }
}
