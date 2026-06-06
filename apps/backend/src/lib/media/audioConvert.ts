import { spawn } from "child_process";

/**
 * Convert a WAV buffer to MP3 using ffmpeg (must be installed on the host).
 * Uses VBR ~165 kbps — sufficient quality for short sound-effect clips.
 */
export function convertWavToMp3(wavBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const proc = spawn("ffmpeg", [
            "-f", "wav",
            "-i", "pipe:0",
            "-codec:a", "libmp3lame",
            "-q:a", "4",
            "-f", "mp3",
            "pipe:1",
        ]);

        const chunks: Buffer[] = [];
        proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
        proc.stderr.resume(); // drain stderr so the process doesn't stall on a full pipe
        proc.on("error", (err) =>
            reject(new Error(`ffmpeg unavailable: ${err.message}`))
        );
        proc.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`ffmpeg exited with code ${code}`));
            } else {
                resolve(Buffer.concat(chunks));
            }
        });

        proc.stdin.write(wavBuffer);
        proc.stdin.end();
    });
}
