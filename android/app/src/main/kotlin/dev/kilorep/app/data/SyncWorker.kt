package dev.kilorep.app.data

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.kilorep.app.KilorepApp
import java.util.concurrent.TimeUnit

/**
 * Background replay: whenever a draft turns dirty this gets enqueued with a
 * connectivity constraint, so an offline workout syncs by itself when the
 * lifter leaves the basement — even if the app was killed meanwhile.
 */
class SyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val repo = (applicationContext as KilorepApp).container.repo
        // syncNow reports whether retryable dirty work remains — including
        // drafts edited while the replay was in flight, which KEEP below
        // would otherwise never come back for.
        return when {
            !repo.syncNow() -> Result.success()
            runAttemptCount < 5 -> Result.retry()
            else -> Result.failure()
        }
    }

    companion object {
        fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniqueWork(
                "kilorep-sync",
                // REPLACE would cancel a running replay on every keystroke,
                // losing in-flight outcome processing; KEEP lets it finish
                // and doWork's retry signal covers edits that land meanwhile.
                ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<SyncWorker>()
                    .setConstraints(
                        Constraints.Builder()
                            .setRequiredNetworkType(NetworkType.CONNECTED)
                            .build(),
                    )
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                    .build(),
            )
        }
    }
}
