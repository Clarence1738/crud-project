<?php

namespace App\Http\Controllers;

use App\Documents\DocumentFiles;
use App\Http\Requests\DocumentRequest;
use App\Models\Document;
use App\Models\Transport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class DocumentController extends Controller
{
    public function __construct(private readonly DocumentFiles $files) {}

    public function index_documents(Request $request): JsonResponse
    {
        $filters = $request->validate(['transport_id' => ['nullable', 'uuid']]);
        $transportId = $filters['transport_id'] ?? null;
        if ($transportId !== null) {
            Gate::authorize('view', Transport::findOrFail($transportId));
        }

        return response()->json(Document::where('user_id', $request->user()->id)
            ->where('transport_id', $transportId)->latest()->paginate(50)->withQueryString());
    }

    public function store_document(DocumentRequest $request): JsonResponse
    {
        $document = new Document($request->safe()->only('title'));
        $document->user_id = $request->user()->id;
        if ($transportId = $request->validated('transport_id')) {
            Gate::authorize('view', Transport::findOrFail($transportId));
            $document->transport_id = $transportId;
        }
        $this->files->save($document, $request->file('file'));

        return response()->json(['data' => $document], 201);
    }

    public function show_document(Document $document): JsonResponse
    {
        Gate::authorize('view', $document);

        return response()->json(['data' => $document]);
    }

    public function update_document(DocumentRequest $request, Document $document): JsonResponse
    {
        Gate::authorize('update', $document);
        $document->fill($request->safe()->only('title'));
        $this->files->save($document, $request->file('file'));

        return response()->json(['data' => $document]);
    }

    public function download_document(Document $document): Response
    {
        Gate::authorize('view', $document);
        return $this->files->download($document);
    }

    public function destroy_document(Document $document): Response
    {
        Gate::authorize('delete', $document);
        $this->files->delete($document);

        return response()->noContent();
    }
}
