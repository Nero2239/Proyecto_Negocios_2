<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interaction;
use Illuminate\Http\Request;

class InteractionController extends Controller
{
    public function index()
    {
        return Interaction::latest()->paginate(30);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'user_id' => 'nullable|exists:users,id',
            'type' => 'required|string',
            'channel' => 'nullable|string',
            'note' => 'nullable|string',
            'occurred_at' => 'nullable|date'
        ]);

        $interaction = Interaction::create($data);
        return response()->json($interaction, 201);
    }
}
