package com.pokescan.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.roundToInt

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var cameraPreview: PreviewView

    private var imageCapture: ImageCapture? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var cardTextAnalyzer: CardTextAnalyzer? = null
    private var analysisExecutor: ExecutorService? = null

    private val permissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->
            if (granted) startNativeCamera()
            else Toast.makeText(
                this,
                "Permissão da câmera necessária.",
                Toast.LENGTH_LONG
            ).show()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        cameraPreview = findViewById(R.id.nativeCameraPreview)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = WebViewClient()

        webView.addJavascriptInterface(
            CameraBridge(),
            "PokéScanAndroid"
        )

        cameraPreview.implementationMode =
            PreviewView.ImplementationMode.COMPATIBLE

        webView.loadUrl(
            "https://viniciusbarcelostcg.github.io/Pok-Scan/"
        )
    }

    private fun requestNativeCamera() {
        if (
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            startNativeCamera()
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun startNativeCamera() {
        val future = ProcessCameraProvider.getInstance(this)

        future.addListener({
            val provider = future.get()

            val preview = Preview.Builder().build()
            preview.surfaceProvider = cameraPreview.surfaceProvider

            val captureUseCase = ImageCapture.Builder()
                .setCaptureMode(
                    ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
                )
                .build()

            val analysisUseCase = ImageAnalysis.Builder()
                .setBackpressureStrategy(
                    ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST
                )
                .build()

            val executor = Executors.newSingleThreadExecutor()

            val analyzer = CardTextAnalyzer { recognizedText ->
                runOnUiThread {
                    val safeText = JSONObject.quote(recognizedText)

                    webView.evaluateJavascript(
                        """
                        (function() {
                            const message =
                                document.getElementById('cameraMessage');

                            if (message) {
                                message.textContent =
                                    'Texto detectado: ' + $safeText;
                            }

                            const status =
                                document.getElementById('status');

                            if (status) status.textContent = 'OCR';
                        })();
                        """.trimIndent(),
                        null
                    )
                }
            }

            analysisUseCase.setAnalyzer(executor, analyzer)

            try {
                provider.unbindAll()

                provider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    captureUseCase,
                    analysisUseCase
                )

                imageCapture = captureUseCase
                imageAnalysis = analysisUseCase
                cardTextAnalyzer = analyzer
                analysisExecutor = executor

                cameraPreview.visibility = View.VISIBLE

                positionPreviewInDialog()

            } catch (error: Exception) {
                analyzer.close()
                executor.shutdown()

                Toast.makeText(
                    this,
                    "Não foi possível abrir a câmera.",
                    Toast.LENGTH_LONG
                ).show()
            }

        }, ContextCompat.getMainExecutor(this))
    }

    private fun positionPreviewInDialog() {
        webView.evaluateJavascript(
            """
            (function() {
                const stage =
                    document.querySelector('#cameraDialog .stage');

                if (!stage || !window.PokéScanAndroid) return;

                const rect = stage.getBoundingClientRect();

                window.PokéScanAndroid.setPreviewBounds(
                    rect.left,
                    rect.top,
                    rect.width,
                    rect.height
                );

                const capture =
                    document.getElementById('capture');

                if (capture) capture.disabled = false;
            })();
            """.trimIndent(),
            null
        )
    }

    private fun updatePreviewBounds(
        left: Float,
        top: Float,
        width: Float,
        height: Float
    ) {
        val density = resources.displayMetrics.density
        val root = webView.parent as FrameLayout

        val webLocation = IntArray(2)
        val rootLocation = IntArray(2)

        webView.getLocationInWindow(webLocation)
        root.getLocationInWindow(rootLocation)

        val leftPx =
            webLocation[0] - rootLocation[0] +
            (left * density).roundToInt()

        val topPx =
            webLocation[1] - rootLocation[1] +
            (top * density).roundToInt()

        val widthPx = (width * density).roundToInt()
        val heightPx = (height * density).roundToInt()

        cameraPreview.layoutParams =
            FrameLayout.LayoutParams(widthPx, heightPx).apply {
                leftMargin = leftPx
                topMargin = topPx
            }
    }

    private fun captureNativePhoto() {
        val capture = imageCapture ?: return

        val photoFile = File(cacheDir, "pokescan_capture.jpg")

        val options =
            ImageCapture.OutputFileOptions.Builder(photoFile).build()

        capture.takePicture(
            options,
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {

                override fun onImageSaved(
                    output: ImageCapture.OutputFileResults
                ) {
                    val encoded = Base64.encodeToString(
                        photoFile.readBytes(),
                        Base64.NO_WRAP
                    )

                    webView.evaluateJavascript(
                        "window.onNativePhotoCaptured && " +
                        "window.onNativePhotoCaptured('data:image/jpeg;base64,$encoded');",
                        null
                    )
                }

                override fun onError(exception: ImageCaptureException) {
                    Toast.makeText(
                        this@MainActivity,
                        "Erro ao capturar fotografia.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        )
    }

    private fun closeNativeCamera() {
        imageAnalysis?.clearAnalyzer()

        ProcessCameraProvider.getInstance(this).get()
            .unbindAll()

        cardTextAnalyzer?.close()
        analysisExecutor?.shutdown()

        imageCapture = null
        imageAnalysis = null
        cardTextAnalyzer = null
        analysisExecutor = null

        cameraPreview.visibility = View.GONE

        webView.evaluateJavascript(
            "document.getElementById('capture').disabled = true;",
            null
        )
    }

    inner class CameraBridge {

        @JavascriptInterface
        fun openCamera() {
            runOnUiThread {
                requestNativeCamera()
            }
        }

        @JavascriptInterface
        fun closeCamera() {
            runOnUiThread {
                closeNativeCamera()
            }
        }

        @JavascriptInterface
        fun capturePhoto() {
            runOnUiThread {
                captureNativePhoto()
            }
        }

        @JavascriptInterface
        fun setPreviewBounds(
            left: Float,
            top: Float,
            width: Float,
            height: Float
        ) {
            runOnUiThread {
                updatePreviewBounds(left, top, width, height)
            }
        }
    }
}