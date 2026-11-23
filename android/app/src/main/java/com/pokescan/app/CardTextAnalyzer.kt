package com.pokescan.app

import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.atomic.AtomicBoolean

class CardTextAnalyzer(
    private val onTextRecognized: (String) -> Unit
) : ImageAnalysis.Analyzer {

    private val recognizer = TextRecognition.getClient(
        TextRecognizerOptions.DEFAULT_OPTIONS
    )

    private val processing = AtomicBoolean(false)

    private var lastAnalysisTime = 0L
    private var pendingText = ""
    private var stableCount = 0
    private var lastEmittedTime = 0L

    @OptIn(ExperimentalGetImage::class)
    override fun analyze(imageProxy: ImageProxy) {

        val now = System.currentTimeMillis()

        if (
            now - lastAnalysisTime < 700 ||
            !processing.compareAndSet(false, true)
        ) {
            imageProxy.close()
            return
        }

        val mediaImage = imageProxy.image

        if (mediaImage == null) {
            processing.set(false)
            imageProxy.close()
            return
        }

        lastAnalysisTime = now

        val inputImage = InputImage.fromMediaImage(
            mediaImage,
            imageProxy.imageInfo.rotationDegrees
        )

        recognizer.process(inputImage)
            .addOnSuccessListener { result ->

                val recognizedText = result.text.trim()

                if (recognizedText.isNotEmpty()) {

                    val normalizedText = recognizedText
                        .uppercase()
                        .replace(Regex("\\s+"), " ")
                        .trim()

                    val similarity = calculateSimilarity(
                        normalizedText,
                        pendingText
                    )

                    if (
                        pendingText.isEmpty() ||
                        similarity >= 0.65
                    ) {
                        stableCount++
                    } else {
                        stableCount = 1
                    }

                    pendingText = normalizedText

                    val currentTime = System.currentTimeMillis()

                    if (
                        stableCount >= 2 &&
                        currentTime - lastEmittedTime >= 1800
                    ) {
                        lastEmittedTime = currentTime
                        onTextRecognized(recognizedText)
                    }
                }
            }
            .addOnCompleteListener {
                processing.set(false)
                imageProxy.close()
            }
    }

    private fun calculateSimilarity(
        first: String,
        second: String
    ): Double {

        if (first.isEmpty() || second.isEmpty()) return 0.0

        val firstWords = first.split(" ").toSet()
        val secondWords = second.split(" ").toSet()

        val intersection = firstWords.intersect(secondWords).size
        val union = firstWords.union(secondWords).size

        return if (union == 0) 0.0
        else intersection.toDouble() / union
    }

    fun close() {
        recognizer.close()
    }
}