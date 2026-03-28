import 'package:flutter/material.dart';

class ReviewScreen extends StatelessWidget {
  const ReviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Review'),
        actions: [
          IconButton(
            icon: const Icon(Icons.playlist_play),
            onPressed: () {
              // TODO: open playlist selector
            },
          ),
        ],
      ),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.play_circle_outline, size: 64, color: Colors.white24),
            SizedBox(height: 16),
            Text(
              'Review & Approval',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ),
            SizedBox(height: 8),
            Text(
              'Select a playlist to review versions.\nSwipe to approve or reject.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white30, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
