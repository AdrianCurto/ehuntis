package com.ehuntis.widget

import com.ehuntis.widget.data.LocalCacheManager
import com.ehuntis.widget.data.UserConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CascadeFallbackTest {

    private val cfg1 = UserConfig(id = "cfg_100", name = "Informática 2º")
    private val cfg2 = UserConfig(id = "cfg_200", name = "Ingeniería Mecánica")
    private val cfg3 = UserConfig(id = "cfg_300", name = "Optativas")

    @Test
    fun testLevel1_AssignedConfigExists() {
        val configs = listOf(cfg1, cfg2, cfg3)
        val resolved = LocalCacheManager.resolveConfig(
            configs = configs,
            assignedId = "cfg_200",
            activeId = "cfg_100"
        )
        assertEquals("cfg_200", resolved?.id)
        assertEquals("Ingeniería Mecánica", resolved?.name)
    }

    @Test
    fun testLevel2_AssignedConfigDeleted_FallbackToActive() {
        // cfg_200 was deleted in the web, so only cfg_100 and cfg_300 exist
        val configs = listOf(cfg1, cfg3)
        val resolved = LocalCacheManager.resolveConfig(
            configs = configs,
            assignedId = "cfg_200", // Deleted!
            activeId = "cfg_300"    // Active
        )
        // Smoothly falls back to activeId!
        assertEquals("cfg_300", resolved?.id)
        assertEquals("Optativas", resolved?.name)
    }

    @Test
    fun testLevel3_AssignedAndActiveMissing_FallbackToFirst() {
        // Neither assigned nor active exists in configs list
        val configs = listOf(cfg2, cfg3)
        val resolved = LocalCacheManager.resolveConfig(
            configs = configs,
            assignedId = "cfg_deleted",
            activeId = "cfg_also_deleted"
        )
        // Smoothly falls back to configs.first()!
        assertEquals("cfg_200", resolved?.id)
        assertEquals("Ingeniería Mecánica", resolved?.name)
    }

    @Test
    fun testLevel4_EmptyConfigs() {
        val resolved = LocalCacheManager.resolveConfig(
            configs = emptyList(),
            assignedId = "cfg_100",
            activeId = "cfg_100"
        )
        assertNull(resolved)
    }

    @Test
    fun testConfigRenamed_ZeroImpact() {
        // User renamed "Informática 2º" to "Informática 2º - Cuatrimestre 2"
        val renamedCfg1 = cfg1.copy(name = "Informática 2º - Cuatrimestre 2")
        val configs = listOf(renamedCfg1, cfg2)

        val resolved = LocalCacheManager.resolveConfig(
            configs = configs,
            assignedId = "cfg_100",
            activeId = "cfg_200"
        )
        // Id is immutable, so it resolves cleanly with the new name!
        assertEquals("cfg_100", resolved?.id)
        assertEquals("Informática 2º - Cuatrimestre 2", resolved?.name)
    }

    @Test
    fun testUserConfigCustomColorsSerialization() {
        val cfgWithColors = UserConfig(
            id = "cfg_colors",
            name = "Test Colores",
            customColors = mapOf("101" to 3, "202" to 7)
        )
        val jsonStr = com.ehuntis.widget.data.ApiClient.json.encodeToString(UserConfig.serializer(), cfgWithColors)
        val decoded = com.ehuntis.widget.data.ApiClient.json.decodeFromString(UserConfig.serializer(), jsonStr)

        assertEquals("cfg_colors", decoded.id)
        assertEquals(2, decoded.customColors.size)
        assertEquals(3, decoded.customColors["101"])
        assertEquals(7, decoded.customColors["202"])
    }
}
