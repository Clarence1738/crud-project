<?php

namespace App\Documents;

use App\Models\Document;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class DocumentFiles
{
    public function download(Document $document): Response
    {
        abort_unless(Storage::disk('private')->exists($document->path), 404);

        return Storage::disk('private')->download($document->path, $document->original_name, [
            'Content-Type' => 'application/octet-stream',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function delete(Document $document): void
    {
        // Delete bytes first so a storage failure leaves a retryable record.
        Storage::disk('private')->delete($document->path);
        $document->delete();
    }

    public function save(Document $document, ?UploadedFile $file): void
    {
        $oldPath = $document->path;
        $newPath = null;
        if ($file) {
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
