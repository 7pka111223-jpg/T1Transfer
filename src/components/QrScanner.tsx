import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'

type QrScannerViewProps = {
  onDecode: (text: string) => void
  className?: string
}

export function QrScannerView({ onDecode, className }: QrScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDecodeRef = useRef(onDecode)
  const hasDecodedRef = useRef(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    onDecodeRef.current = onDecode
  }, [onDecode])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    hasDecodedRef.current = false

    const scanner = new QrScanner(
      video,
      (result) => {
        // The scanner decodes on every camera frame while a code is in view;
        // emit a single result so one scan can never trigger two check-ins.
        if (hasDecodedRef.current) return
        hasDecodedRef.current = true
        scanner.stop()
        onDecodeRef.current(result.data)
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        preferredCamera: 'environment',
        returnDetailedScanResult: true,
      }
    )

    scanner.start().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      setCameraError(
        /permission|denied|notallowed/i.test(message)
          ? 'Camera access was blocked. Allow camera access and try again.'
          : 'Could not start the camera on this device.'
      )
    })

    return () => {
      scanner.stop()
      scanner.destroy()
    }
  }, [])

  return (
    <div className={className}>
      <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      </div>
      <p className={`mt-3 text-sm text-center ${cameraError ? 'text-red-400' : 'text-muted-foreground'}`}>
        {cameraError ?? 'Point your camera at the QR code shown at the gym'}
      </p>
    </div>
  )
}
