package com.pokescan.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
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
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var cameraPreview: PreviewView
    private lateinit var cameraControls: LinearLayout

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

            val cameraSelector =
                CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()

                cameraProvider.bindToLifecycle(
                    this,
                    cameraSelector,
                    preview
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

    private fun closeNativeCamera() {
        val cameraProvider =
            ProcessCameraProvider.getInstance(this).get()

        cameraProvider.unbindAll()

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
    }
}