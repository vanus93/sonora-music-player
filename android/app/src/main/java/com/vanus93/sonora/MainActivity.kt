package com.vanus93.sonora

import android.app.Activity
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.audiofx.Equalizer
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView

class MainActivity : Activity() {
    private var player: MediaPlayer? = null
    private var equalizer: Equalizer? = null
    private var selectedUri: Uri? = null
    private var timerSeconds = 0L
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var playButton: Button
    private lateinit var progressBar: SeekBar
    private lateinit var currentTimeText: TextView
    private lateinit var totalTimeText: TextView
    private lateinit var timerText: TextView

    private val progressTask = object : Runnable {
        override fun run() {
            player?.let { if (it.isPlaying) { progressBar.progress = it.currentPosition; currentTimeText.text = time(it.currentPosition); } }
            handler.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        bindControls()
        handler.post(progressTask)
    }

    private fun bindControls() {
        playButton = findViewById(R.id.playButton)
        progressBar = findViewById(R.id.progressBar)
        currentTimeText = findViewById(R.id.currentTimeText)
        totalTimeText = findViewById(R.id.totalTimeText)
        timerText = findViewById(R.id.timerText)
        findViewById<Button>(R.id.addButton).setOnClickListener { chooseAudio() }
        playButton.setOnClickListener { togglePlayback() }
        findViewById<Button>(R.id.previousButton).setOnClickListener { player?.seekTo(0) }
        findViewById<Button>(R.id.nextButton).setOnClickListener { player?.seekTo(player?.duration ?: 0) }
        findViewById<SeekBar>(R.id.volumeBar).setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar: SeekBar?, value: Int, fromUser: Boolean) { if (fromUser) player?.setVolume(value / 100f, value / 100f) }
            override fun onStartTrackingTouch(bar: SeekBar?) = Unit
            override fun onStopTrackingTouch(bar: SeekBar?) = Unit
        })
        progressBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar: SeekBar?, value: Int, fromUser: Boolean) { if (fromUser) player?.seekTo(value) }
            override fun onStartTrackingTouch(bar: SeekBar?) = Unit
            override fun onStopTrackingTouch(bar: SeekBar?) = Unit
        })
        setupEqualizer()
        findViewById<Button>(R.id.timer15Button).setOnClickListener { startTimer(15) }
        findViewById<Button>(R.id.timer30Button).setOnClickListener { startTimer(30) }
        findViewById<Button>(R.id.timer60Button).setOnClickListener { startTimer(60) }
        findViewById<Button>(R.id.timerOffButton).setOnClickListener { timerSeconds = 0; timerText.text = "Timer mati" }
    }

    private fun chooseAudio() {
        startActivityForResult(android.content.Intent(android.content.Intent.ACTION_OPEN_DOCUMENT).apply { type = "audio/*"; putExtra(android.content.Intent.EXTRA_ALLOW_MULTIPLE, false); addCategory(android.content.Intent.CATEGORY_OPENABLE) }, 10)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 10 && resultCode == RESULT_OK) data?.data?.let { selectedUri = it; contentResolver.takePersistableUriPermission(it, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION); prepare(it) }
    }

    private fun prepare(uri: Uri) {
        player?.release(); equalizer?.release()
        player = MediaPlayer().apply {
            setAudioAttributes(AudioAttributes.Builder().setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).setUsage(AudioAttributes.USAGE_MEDIA).build())
            setDataSource(this@MainActivity, uri); setOnPreparedListener { media -> progressBar.max = media.duration; totalTimeText.text = time(media.duration); findViewById<TextView>(R.id.titleText).text = uri.lastPathSegment?.substringAfterLast('/') ?: "Local music"; findViewById<TextView>(R.id.artistText).text = "File lokal"; setupEqualizer(); togglePlayback() }; prepareAsync()
            setOnCompletionListener { playButton.text = "▶" }
        }
    }

    private fun setupEqualizer() {
        val media = player ?: return
        equalizer?.release(); equalizer = Equalizer(0, media.audioSessionId).apply { enabled = true }
        val layout = findViewById<LinearLayout>(R.id.equalizerLayout); layout.removeAllViews()
        val range = equalizer?.bandLevelRange ?: shortArrayOf(-1200, 1200)
        for (band in 0 until (equalizer?.numberOfBands?.toInt() ?: 0)) { val seek = SeekBar(this); seek.max = range[1] - range[0]; seek.progress = -(range[0].toInt()); seek.rotation = -90f; seek.layoutParams = LinearLayout.LayoutParams(52, 120); seek.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener { override fun onProgressChanged(bar: SeekBar?, value: Int, fromUser: Boolean) { if (fromUser) equalizer?.setBandLevel(band.toShort(), (value + range[0]).toShort()) }; override fun onStartTrackingTouch(bar: SeekBar?) = Unit; override fun onStopTrackingTouch(bar: SeekBar?) = Unit }); layout.addView(seek) }
    }

    private fun togglePlayback() { val media = player ?: return; if (media.isPlaying) { media.pause(); playButton.text = "▶" } else { media.start(); playButton.text = "Ⅱ" } }
    private fun startTimer(minutes: Int) { timerSeconds = minutes * 60L; timerText.text = "Berhenti dalam ${minutes} menit"; handler.post(object : Runnable { override fun run() { if (timerSeconds <= 0) { player?.pause(); timerText.text = "Playback berhenti" } else { timerText.text = "Sisa ${time(timerSeconds * 1000)}"; timerSeconds--; handler.postDelayed(this, 1000) } } }) }
    private fun time(milliseconds: Int): String = time(milliseconds.toLong())
    private fun time(milliseconds: Long): String = String.format("%02d:%02d", (milliseconds / 60000), (milliseconds / 1000) % 60)
    override fun onDestroy() { handler.removeCallbacksAndMessages(null); equalizer?.release(); player?.release(); super.onDestroy() }
}
