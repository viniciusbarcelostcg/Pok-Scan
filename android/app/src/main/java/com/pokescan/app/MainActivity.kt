package com.pokescan.app

import android.Manifest
import android.content.pm.PackageManager
import android.hardware.camera2.CaptureRequest
import android.os.Bundle
import android.util.Base64
import android.view.MotionEvent
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var cameraPreview: PreviewView

    private var imageCapture: ImageCapture? = null
    private var activeCamera: Camera? = null

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

        cameraPreview.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_UP) {
                focusAt(event.x, event.y)
            }
            true
        }

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

            val previewBuilder = Preview.Builder()

            Camera2Interop.Extender(previewBuilder)
                .setCaptureRequestOption(
                    CaptureRequest.CONTROL_AF_MODE,
                    CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE
                )

            val preview = previewBuilder.build()
            preview.surfaceProvider = cameraPreview.surfaceProvider

            val captureUseCase = ImageCapture.Builder()
                .setCaptureMode(
                    ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
                )
                .build()

            try {
                provider.unbindAll()

                activeCamera = provider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    captureUseCase
                )

                imageCapture = captureUseCase

                cameraPreview.visibility = View.VISIBLE

                positionPreviewInDialog()

            } catch (error: Exception) {
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
                const stage = document.querySelector('#cameraDialog .stage');
                if (!stage || !window.PokéScanAndroid) return;

                const rect = stage.getBoundingClientRect();

                window.PokéScanAndroid.setPreviewBounds(
                    rect.left,
                    rect.top,
                    rect.width,
                    rect.height
                );

                const capture = document.getElementById('capture');
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

    private fun focusAt(x: Float, y: Float) {
        val camera = activeCamera ?: return

        val point = cameraPreview.meteringPointFactory
            .createPoint(x, y)

        val action = FocusMeteringAction.Builder(
            point,
            FocusMeteringAction.FLAG_AF or
                FocusMeteringAction.FLAG_AE
        )
            .setAutoCancelDuration(3, TimeUnit.SECONDS)
            .build()

        camera.cameraControl.startFocusAndMetering(action)
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
        imageCapture = null
        activeCamera = null

        ProcessCameraProvider.getInstance(this).get()
            .unbindAll()

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