package com.ngabopay.ussd.api

import com.ngabopay.ussd.BuildConfig
import com.ngabopay.ussd.NgaboPayApp
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private var retrofit: Retrofit? = null
    private var api: NgaboPayApi? = null

    fun getApi(): NgaboPayApi {
        if (api == null) {
            api = getRetrofit().create(NgaboPayApi::class.java)
        }
        return api!!
    }

    fun resetClient() {
        retrofit = null
        api = null
    }

    private fun getRetrofit(): Retrofit {
        if (retrofit == null) {
            val prefs = NgaboPayApp.instance.preferencesManager
            val serverUrl = prefs.getServerUrl() ?: BuildConfig.API_BASE_URL

            // Ensure base URL ends with /api/
            val baseUrl = when {
                serverUrl.endsWith("/api/") -> serverUrl
                serverUrl.endsWith("/api") -> "$serverUrl/"
                serverUrl.endsWith("/") -> "${serverUrl}api/"
                else -> "$serverUrl/api/"
            }

            retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(getOkHttpClient())
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
        return retrofit!!
    }

    private fun getOkHttpClient(): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        val authInterceptor = Interceptor { chain ->
            val prefs = NgaboPayApp.instance.preferencesManager
            val token = prefs.getApiToken()
            val deviceId = prefs.getDeviceId()

            val requestBuilder = chain.request().newBuilder()
                .addHeader("Content-Type", "application/json")
                .addHeader("X-Device-Id", deviceId)

            if (token != null) {
                requestBuilder.addHeader("Authorization", "Bearer $token")
            }

            chain.proceed(requestBuilder.build())
        }

        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }
}
