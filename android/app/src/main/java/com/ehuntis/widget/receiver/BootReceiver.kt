package com.ehuntis.widget.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.ehuntis.widget.TimetableWidgetProvider
import com.ehuntis.widget.worker.TimetableSyncWorker

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            TimetableSyncWorker.enqueuePeriodicSync(context)
            TimetableWidgetProvider.updateAllWidgets(context)
        }
    }
}
