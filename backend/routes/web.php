<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\TransportController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::prefix('api')->middleware('private.responses')->group(function (): void {
    Route::get('csrf', fn () => response()->json(['token' => csrf_token()]));
    Route::post('register', [AuthController::class, 'register_user'])->middleware('throttle:6,1');
    Route::post('login', [AuthController::class, 'login_user'])->middleware('throttle:login');

    Route::middleware('auth')->group(function (): void {
        Route::get('me', [AuthController::class, 'show_authenticated_user']);
        Route::get('record-revisions', function (Request $request) {
            $revisions = DB::table('record_revisions')->where('user_id', $request->user()->id)
                ->pluck('revision', 'resource');

            return response()->json([
                'transports' => (string) ($revisions['transports'] ?? 0),
                'documents' => (string) ($revisions['documents'] ?? 0),
                'date' => now('Africa/Nairobi')->toDateString(),
            ]);
        });
        Route::post('logout', [AuthController::class, 'logout_user']);
        Route::get('transports', [TransportController::class, 'index_transports'])->name('transports.index');
        Route::get('transports/calendar', [TransportController::class, 'calendar']);
        Route::get('transports/analytics', [TransportController::class, 'analytics']);
        Route::get('transports/export', [TransportController::class, 'export']);
        Route::patch('transports/{transport}/status', [TransportController::class, 'update_transport_status']);
        Route::post('transports', [TransportController::class, 'store_transport'])->name('transports.store');
        Route::get('transports/{transport}', [TransportController::class, 'show_transport'])->name('transports.show');
        Route::match(['put', 'patch'], 'transports/{transport}', [TransportController::class, 'update_transport'])->name('transports.update');
        Route::delete('transports/{transport}', [TransportController::class, 'destroy_transport'])->name('transports.destroy');
        Route::get('documents/{document}/download', [DocumentController::class, 'download_document']);
        Route::get('documents', [DocumentController::class, 'index_documents'])->name('documents.index');
        Route::post('documents', [DocumentController::class, 'store_document'])->name('documents.store');
        Route::get('documents/{document}', [DocumentController::class, 'show_document'])->name('documents.show');
        Route::match(['put', 'patch'], 'documents/{document}', [DocumentController::class, 'update_document'])->name('documents.update');
        Route::delete('documents/{document}', [DocumentController::class, 'destroy_document'])->name('documents.destroy');
    });
});
