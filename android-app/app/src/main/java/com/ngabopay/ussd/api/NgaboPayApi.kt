package com.ngabopay.ussd.api

import com.ngabopay.ussd.model.*
import retrofit2.Response
import retrofit2.http.*

interface NgaboPayApi {

    @POST("config/devices/register")
    suspend fun registerDevice(
        @Body registration: DeviceRegistration
    ): Response<DeviceRegistrationResponse>

    @POST("config/devices/{id}/heartbeat")
    suspend fun sendHeartbeat(
        @Path("id") deviceId: String
    ): Response<Unit>

    @GET("payouts/pending")
    suspend fun getPendingPayouts(): Response<PendingPayoutsResponse>

    @POST("payouts/{id}/complete")
    suspend fun completePayout(
        @Path("id") payoutId: String,
        @Body result: PayoutResponse
    ): Response<Unit>

    @POST("payouts/{id}/fail")
    suspend fun failPayout(
        @Path("id") payoutId: String,
        @Body result: PayoutResponse
    ): Response<Unit>

    @GET("config")
    suspend fun getConfigs(): Response<ConfigResponse>
}
