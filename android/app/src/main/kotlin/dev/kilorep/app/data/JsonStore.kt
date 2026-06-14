package dev.kilorep.app.data

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import dev.kilorep.api.infrastructure.Serializer
import java.io.File

/**
 * One JSON file per concern (drafts, cached sessions, …), written atomically
 * — temp file then rename — so a process death mid-write can never corrupt
 * the active workout. The files are per-user-tiny; durability beats cleverness.
 */
class JsonStore(private val dir: File) {

    /** The generated client's Moshi — its adapters cover the cached models. */
    val moshi: Moshi = Serializer.moshi

    // Concurrent writers share the per-name .tmp file; without mutual
    // exclusion two interleaved writes can rename a half-written file into
    // place and read() will silently drop the store.
    private val lock = Any()

    fun <T> read(name: String, adapter: JsonAdapter<T>): T? = synchronized(lock) {
        val file = File(dir, name)
        if (!file.exists()) {
            null
        } else {
            try {
                adapter.fromJson(file.readText())
            } catch (_: Exception) {
                // An unreadable cache is re-fetchable; an unreadable draft is
                // gone either way — never let a corrupt file brick startup.
                null
            }
        }
    }

    fun <T> write(name: String, adapter: JsonAdapter<T>, value: T) {
        synchronized(lock) {
            dir.mkdirs()
            val tmp = File(dir, "$name.tmp")
            tmp.writeText(adapter.toJson(value))
            if (!tmp.renameTo(File(dir, name))) {
                tmp.copyTo(File(dir, name), overwrite = true)
                tmp.delete()
            }
        }
    }

    fun delete(name: String) {
        synchronized(lock) { File(dir, name).delete() }
    }
}
