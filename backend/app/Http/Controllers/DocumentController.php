<?php

namespace App\Http\Controllers;

use App\Http\Requests\DocumentRequest;
use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class DocumentController extends Controller
{
    public function index_documents(Request $request): JsonResponse
    {
        return response()->json(Document::where('user_id', $request->user()->id)->latest()->paginate(50));
    }

    public function store_document(DocumentRequest $request): JsonResponse
    {
        $document = new Document($request->safe()->only('title'));
        $document->user_id = $request->user()->id;
        $this->save_document_file($request, $document);

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
        $this->save_document_file($request, $document);

        return response()->json(['data' => $document]);
    }

    public function download_document(Document $document): Response
    {
        Gate::authorize('view', $document);
        abort_unless(Storage::disk('private')->exists($document->path), 404);

        return Storage::disk('private')->download($document->path, $document->original_name, [
            'Content-Type' => 'application/octet-stream',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroy_document(Document $document): Response
    {
        Gate::authorize('delete', $document);
        // Delete bytes first: a storage failure leaves an authorized, retryable record.
        Storage::disk('private')->delete($document->path);
        $document->delete();

        return response()->noContent();
    }

    private function save_document_file(DocumentRequest $request, Document $document): void
    {
        $oldPath = $document->path;
        $newPath = null;
        if ($file = $request->file('file')) {
            $newPath = $file->store($document->user_id, 'private');
            $document->path = $newPath;
            $document->original_name = basename(str_replace('\\', '/', $file->getClientOriginalName()));
            $document->mime_type = $file->getMimeType();
            $document->size = $file->getSize();
        }

        try {
            $document->save();
        } catch (\Throwable $exception) {
            if ($newPath) {
                Storage::disk('private')->delete($newPath);
            }
            throw $exception;
        }

        if ($newPath && $oldPath) {
            Storage::disk('private')->delete($oldPath);
        }
    }
}
