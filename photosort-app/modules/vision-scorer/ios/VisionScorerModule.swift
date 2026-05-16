import ExpoModulesCore
import Vision
import CoreGraphics
import UIKit
import Photos

public class VisionScorerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VisionScorer")

    // Batch-fetch PHAsset.location for a list of asset IDs.
    // Returns an array of { id, latitude, longitude } — entries with no GPS are omitted.
    AsyncFunction("getAssetLocations") { (assetIds: [String], promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: assetIds, options: nil)
        var locations: [[String: Any]] = []
        fetchResult.enumerateObjects { asset, _, _ in
          guard
            let loc = asset.location,
            loc.coordinate.latitude != 0 || loc.coordinate.longitude != 0
          else { return }
          locations.append([
            "id": asset.localIdentifier,
            "latitude": loc.coordinate.latitude,
            "longitude": loc.coordinate.longitude,
          ])
        }
        promise.resolve(locations)
      }
    }

    AsyncFunction("scorePhoto") { (localUri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard
          let url = URL(string: localUri),
          let data = try? Data(contentsOf: url),
          let uiImage = UIImage(data: data),
          let cgImage = uiImage.cgImage
        else {
          // Return neutral scores rather than failing — caller can still use file-size proxy
          promise.resolve(["sharpness": 0.5, "faceCount": 0, "saliency": 0.5])
          return
        }

        // 1. Sharpness — Laplacian variance on a 256×256 grayscale downsample
        let sharpness = Self.laplacianSharpness(cgImage: cgImage)

        // 2. Face detection + saliency via Vision (synchronous on this thread)
        var faceCount = 0
        var saliency: Float = 0.5

        let faceRequest = VNDetectFaceRectanglesRequest()
        let saliencyRequest = VNGenerateAttentionBasedSaliencyImageRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

        try? handler.perform([faceRequest, saliencyRequest])

        faceCount = faceRequest.results?.count ?? 0

        if let obs = saliencyRequest.results?.first as? VNSaliencyImageObservation,
           let best = obs.salientObjects?.max(by: { $0.confidence < $1.confidence }) {
          saliency = Float(best.confidence)
        }

        promise.resolve([
          "sharpness": sharpness,
          "faceCount": faceCount,
          "saliency": saliency,
        ])
      }
    }
  }

  // MARK: – Laplacian variance sharpness

  /// Downsample to 256×256 grayscale, apply 5-point Laplacian, return normalised variance.
  /// Variance > 500 → very sharp (≈ 1.0). Variance < 10 → very blurry (≈ 0.0).
  private static func laplacianSharpness(cgImage: CGImage) -> Float {
    let dim = 256
    let colorSpace = CGColorSpaceCreateDeviceGray()
    guard let ctx = CGContext(
      data: nil,
      width: dim,
      height: dim,
      bitsPerComponent: 8,
      bytesPerRow: dim,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.none.rawValue
    ) else { return 0.5 }

    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: dim, height: dim))

    guard let pixelBuffer = ctx.data else { return 0.5 }
    let pixels = pixelBuffer.bindMemory(to: UInt8.self, capacity: dim * dim)

    var sum: Float = 0
    var sumSq: Float = 0
    let inner = dim - 2  // skip 1-pixel border

    for y in 1...inner {
      for x in 1...inner {
        let i = y * dim + x
        let lap = Float(
          -4 * Int(pixels[i])
            + Int(pixels[i - 1])
            + Int(pixels[i + 1])
            + Int(pixels[i - dim])
            + Int(pixels[i + dim])
        )
        sum += lap
        sumSq += lap * lap
      }
    }

    let n = Float(inner * inner)
    let mean = sum / n
    let variance = sumSq / n - mean * mean

    // Normalise: cap at 500 → maps to 1.0
    return min(max(variance / 500.0, 0.0), 1.0)
  }
}
