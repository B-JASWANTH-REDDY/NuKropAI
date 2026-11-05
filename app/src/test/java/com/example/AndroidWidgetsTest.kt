package com.example

import com.example.widget.WeatherWidgetProvider
import com.example.widget.MandiWidgetProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AndroidWidgetsTest {

    @Test
    fun testWeatherWidgetConstantsAndConfiguration() {
        assertEquals("nukrop_weather_widget", WeatherWidgetProvider.PREFS_NAME)
        assertEquals("com.example.widget.ACTION_WEATHER_UPDATED", WeatherWidgetProvider.ACTION_WEATHER_UPDATED)
        assertEquals("com.example.widget.ACTION_LOGOUT", WeatherWidgetProvider.ACTION_LOGOUT)
        
        val provider = WeatherWidgetProvider()
        assertNotNull("WeatherWidgetProvider must instantiate cleanly", provider)
    }

    @Test
    fun testMandiWidgetConstantsAndConfiguration() {
        assertEquals("nukrop_mandi_widget", MandiWidgetProvider.PREFS_NAME)
        assertEquals("com.example.widget.ACTION_MANDI_UPDATED", MandiWidgetProvider.ACTION_MANDI_UPDATED)
        assertEquals("com.example.widget.ACTION_LOGOUT", MandiWidgetProvider.ACTION_LOGOUT)
        
        val provider = MandiWidgetProvider()
        assertNotNull("MandiWidgetProvider must instantiate cleanly", provider)
    }

    @Test
    fun testPortalSecurityAllowlist() {
        // Enforces strict security boundary for official government URLs
        assertTrue(MainActivity.isAllowedPortalUrl("https://agmarknet.gov.in"))
        assertTrue(MainActivity.isAllowedPortalUrl("https://bhubharati.telangana.gov.in"))
        assertTrue(MainActivity.isAllowedPortalUrl("https://upbhulekh.gov.in"))
        
        // Rejects non-https, unapproved ports, embedded credentials
        assertEquals(false, MainActivity.isAllowedPortalUrl("http://agmarknet.gov.in"))
        assertEquals(false, MainActivity.isAllowedPortalUrl("https://user:pass@agmarknet.gov.in"))
        assertEquals(false, MainActivity.isAllowedPortalUrl("https://attacker-site.com"))
    }
}
