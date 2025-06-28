/*
  # Create match-highlights storage bucket

  1. New Storage Bucket
    - `match-highlights` bucket for storing video highlight files
    - Public access enabled for video playback
    - File size limit set to 100MB per file
    - Allowed file types: video formats (webm, mp4, mov)

  2. Security
    - RLS policies for authenticated users to upload their own highlights
    - Public read access for video playback
    - Users can only delete their own highlights

  3. Configuration
    - Automatic file cleanup after 30 days (optional)
    - Optimized for video storage and streaming
*/

-- Create the match-highlights storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'match-highlights',
  'match-highlights', 
  true,
  104857600, -- 100MB limit
  ARRAY['video/webm', 'video/mp4', 'video/quicktime', 'video/x-msvideo']
);

-- Enable RLS on the storage.objects table for this bucket
CREATE POLICY "Users can upload their own match highlights"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'match-highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view match highlights"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'match-highlights');

CREATE POLICY "Users can update their own match highlights"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'match-highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own match highlights"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'match-highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );