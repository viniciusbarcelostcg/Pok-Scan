package com.pokescan.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var cameraPreview: PreviewView
    private lateinit var cameraControls: LinearLayout

    private var imageCapture: ImageCapture? = null

    private val permissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->
            if (granted) {
                startNativeCamera()
            } else {
                Toast.makeText(
                    this,
                    "Permissão da câmera necessária.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        cameraPreview = findViewById(R.id.nativeCameraPreview)
        cameraControls = findViewById(R.id.nativeCameraControls)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = WebViewClient()

        webView.addJavascriptInterface(
            CameraBridge(),
            "PokéScanAndroid"
        )

        findViewById<Button>(R.id.nativeCaptureButton)
            .setOnClickListener {
                captureNativePhoto()
            }

        findViewById<Button>(R.id.nativeCloseButton)
            .setOnClickListener {
                closeNativeCamera()
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
        val cameraProviderFuture =
            ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({

            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build()

            preview.surfaceProvider =
                cameraPreview.surfaceProvider

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(
                    ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY
                )
                .build()

            try {
                cameraProvider.unbindAll()

                cameraProvider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageCapture
                )

                cameraPreview.visibility = View.VISIBLE
                cameraControls.visibility = View.VISIBLE

            } catch (error: Exception) {
                Toast.makeText(
                    this,
                    "Não foi possível abrir a câmera.",
                    Toast.LENGTH_LONG
                ).show()
            }

        }, ContextCompat.getMainExecutor(this))
    }

    private fun captureNativePhoto() {
        val capture = imageCapture ?: return

        val photoFile = File(
            cacheDir,
            "pokescan_capture.jpg"
        )

        val outputOptions =
            ImageCapture.OutputFileOptions.Builder(photoFile)
                .build()

        capture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {

                override fun onImageSaved(
                    output: ImageCapture.OutputFileResults
                ) {
                    val bytes = photoFile.readBytes()

                    val encoded = Base64.encodeToString(
                        bytes,
                        Base64.NO_WRAP
                    )

                    webView.evaluateJavascript(
                        "window.onNativePhotoCaptured && " +
                        "window.onNativePhotoCaptured('data:image/jpeg;base64,$encoded');",
                        null
                    )

                    Toast.makeText(
                        this@MainActivity,
                        "Fotografia capturada!",
                        Toast.LENGTH_SHORT
                    ).show()
                }

                override fun onError(
                    exception: ImageCaptureException
                ) {
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
        if (!::cameraPreview.isInitialized) return

        imageCapture = null

        ProcessCameraProvider.getInstance(this).get()
            .unbindAll()

        cameraPreview.visibility = View.GONE
        cameraControls.visibility = View.GONE
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
    }
}