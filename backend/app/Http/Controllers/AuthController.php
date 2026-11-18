<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    public function register_user(RegisterRequest $request): JsonResponse
    {
        $user = User::create($request->validated());
        Auth::login($user);
        $request->session()->regenerate();

        return response()->json(['data' => $user], 201);
    }

    public function login_user(LoginRequest $request): JsonResponse
    {
        if (! Auth::attempt($request->validated())) {
            throw ValidationException::withMessages(['email' => ['The credentials are incorrect.']]);
        }

        $request->session()->regenerate();

        return response()->json(['data' => $request->user()]);
    }

    public function show_authenticated_user(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()]);
    }

    public function logout_user(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
