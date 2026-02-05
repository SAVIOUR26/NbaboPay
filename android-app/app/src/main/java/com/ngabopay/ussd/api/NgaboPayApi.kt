package com.ngabopay.ussd.api

import com.ngabopay.ussd.model.*
import retrofit2.Response
import retrofit2.http.*

interface NgaboPayApi {

    @POST("device/register")
    suspend fun registerDevice(
        @Body registration: DeviceRegistration
    ): Response<DeviceRegistrationResponse>

    @POST("device/heartbeat")
    suspend fun sendHeartbeat(): Response<HeartbeatResponse>

    @GET("device/pending-payouts")
    suspend fun getPendingPayouts(): Response<PendingPayoutsResponse>

    @POST("device/payout/{id}/start")
    suspend fun startPayout(
        @Path("id") payoutId: String
    ): Response<GenericResponse>

    @POST("device/payout/{id}/complete")
    suspend fun completePayout(
        @Path("id") payoutId: String,
        @Body result: PayoutCompleteRequest
    ): Response<GenericResponse>

    @POST("device/payout/{id}/fail")
    suspend fun failPayout(
        @Path("id") payoutId: String,
        @Body result: PayoutFailRequest
    ): Response<PayoutFailResponse>

    @GET("device/config")
    suspend fun getConfigs(): Response<DeviceConfigResponse>
}
