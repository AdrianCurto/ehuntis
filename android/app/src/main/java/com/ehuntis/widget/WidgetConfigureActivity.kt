package com.ehuntis.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.ehuntis.widget.data.ApiClient
import com.ehuntis.widget.data.LocalCacheManager
import com.ehuntis.widget.data.UserConfig
import com.ehuntis.widget.ui.theme.EHUntisTheme
import com.ehuntis.widget.worker.TimetableSyncWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class WidgetConfigureActivity : ComponentActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(android.graphics.Color.BLACK))

        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        val resultValue = Intent().apply { putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId) }
        setResult(RESULT_CANCELED, resultValue)

        setContent {
            EHUntisTheme {
                WidgetConfigScreen(
                    context = this,
                    appWidgetId = appWidgetId,
                    onFinish = {
                        setResult(RESULT_OK, resultValue)
                        finish()
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WidgetConfigScreen(
    context: Context,
    appWidgetId: Int,
    onFinish: () -> Unit
) {
    val cache = remember { LocalCacheManager.getInstance(context) }
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    var username by remember { mutableStateOf(cache.getUsername() ?: "") }
    var isLoading by remember { mutableStateOf(false) }
    var configs by remember { mutableStateOf<List<UserConfig>>(emptyList()) }
    var activeConfigId by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isEditingUser by remember { mutableStateOf(false) }

    // Cargar configuraciones guardadas de forma asíncrona
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            val loadedConfigs = cache.getUserData()?.configs ?: emptyList()
            if (loadedConfigs.isNotEmpty()) {
                configs = loadedConfigs
                activeConfigId = cache.getActiveConfigId()
            }
        }
    }

    // Opciones del widget
    var selectedConfigId by remember { mutableStateOf<String?>(cache.getWidgetConfigId(appWidgetId)) }
    var widgetViewMode by remember { mutableStateOf(cache.getWidgetViewMode(appWidgetId)) }
    var themeMode by remember { mutableStateOf(cache.getThemeMode()) }

    val accountConfigured by remember(configs) {
        derivedStateOf { configs.isNotEmpty() }
    }

    // Estado para optimización de batería
    val powerManager = remember { context.getSystemService(Context.POWER_SERVICE) as PowerManager }
    var isIgnoringBatteryOptimizations by remember {
        mutableStateOf(powerManager.isIgnoringBatteryOptimizations(context.packageName))
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                isIgnoringBatteryOptimizations = powerManager.isIgnoringBatteryOptimizations(context.packageName)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    val batterySettingsLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) {
        isIgnoringBatteryOptimizations = powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Ajustes del Widget",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "EHUntis para UPV/EHU",
                            fontSize = 11.5.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                }
            )
        },
        bottomBar = {
            Surface(
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 6.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    Button(
                        onClick = {
                            scope.launch {
                                cache.saveWidgetViewMode(appWidgetId, widgetViewMode)
                                cache.saveThemeMode(themeMode)
                                cache.saveWidgetConfigId(appWidgetId, selectedConfigId)

                                com.ehuntis.widget.data.WidgetAnalytics.trackConfigured(
                                    username = username,
                                    configId = selectedConfigId,
                                    viewMode = widgetViewMode,
                                    themeMode = themeMode
                                )

                                TimetableSyncWorker.enqueueImmediateSync(context, force = true)
                                TimetableSyncWorker.enqueuePeriodicSync(context)

                                if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                                    TimetableWidgetProvider.updateAppWidget(
                                        context,
                                        AppWidgetManager.getInstance(context),
                                        appWidgetId
                                    )
                                }

                                if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
                                    val appWidgetManager = AppWidgetManager.getInstance(context)
                                    if (appWidgetManager.isRequestPinAppWidgetSupported) {
                                        val myProvider = ComponentName(context, TimetableWidgetProvider::class.java)
                                        val successIntent = Intent(context, com.ehuntis.widget.receiver.PinnedReceiver::class.java)
                                        val successPendingIntent = PendingIntent.getBroadcast(
                                            context,
                                            0,
                                            successIntent,
                                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                                        )
                                        appWidgetManager.requestPinAppWidget(myProvider, null, successPendingIntent)
                                    }
                                }

                                onFinish()
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(14.dp),
                        enabled = accountConfigured
                    ) {
                        Text(
                            text = if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID)
                                "Guardar y añadir widget"
                            else "Guardar y actualizar widget",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    ) { paddingValues ->

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item { Spacer(modifier = Modifier.height(2.dp)) }

            // 1. Banner de Optimización de Batería (si procede)
            item {
                AnimatedVisibility(visible = !isIgnoringBatteryOptimizations) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)),
                        onClick = {
                            try {
                                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                    data = Uri.parse("package:${context.packageName}")
                                }
                                batterySettingsLauncher.launch(intent)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = null,
                                tint = Color(0xFFD97706),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Optimización de batería activa",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.5.sp,
                                    color = Color(0xFF92400E)
                                )
                                Text(
                                    text = "Android puede limitar la actualización de clases. Toca para permitir.",
                                    fontSize = 11.5.sp,
                                    color = Color(0xFFB45309)
                                )
                            }
                        }
                    }
                }
            }

            // 2. Tarjeta de Cuenta UPV/EHU
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        if (accountConfigured && !isEditingUser) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(Color.White),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Image(
                                        painter = painterResource(id = R.drawable.ic_launcher_foreground_logo),
                                        contentDescription = "EHUntis",
                                        modifier = Modifier.size(38.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            modifier = Modifier
                                                .size(7.dp)
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(Color(0xFF10B981))
                                        )
                                        Spacer(modifier = Modifier.width(5.dp))
                                        Text(
                                            text = "Conectado · $username",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.5.sp
                                        )
                                    }
                                    Text(
                                        text = "${configs.size} horario(s) sincronizado(s)",
                                        fontSize = 11.5.sp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    )
                                }
                                TextButton(
                                    onClick = { isEditingUser = true },
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text("Cambiar", fontSize = 12.5.sp)
                                }
                            }
                        } else {
                            Text(
                                text = "Cuenta de EHUntis",
                                fontSize = 14.5.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                            OutlinedTextField(
                                value = username,
                                onValueChange = { username = it },
                                label = { Text("Identificador de alumno") },
                                placeholder = { Text("ej. 1234567") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp),
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                                keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() })
                            )
                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                if (accountConfigured) {
                                    OutlinedButton(
                                        onClick = { isEditingUser = false },
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text("Cancelar")
                                    }
                                }
                                Button(
                                    onClick = {
                                        if (username.isNotBlank()) {
                                            isLoading = true
                                            errorMessage = null
                                            focusManager.clearFocus()

                                            scope.launch(Dispatchers.IO) {
                                                try {
                                                    val result = ApiClient.fetchUserData(username)
                                                    if (result.isFailure) throw result.exceptionOrNull() ?: Exception("Error al conectar")
                                                    val response = result.getOrNull()!!

                                                    cache.saveUsername(username.trim())
                                                    cache.saveUserData(response)
                                                    if (response.active_config_id != null) {
                                                        cache.saveActiveConfigId(response.active_config_id)
                                                    }

                                                    val allClassIds = response.configs.flatMap { it.allClassIds }.distinct()
                                                    if (allClassIds.isNotEmpty()) {
                                                        try {
                                                            val ttResult = ApiClient.fetchTimetable(allClassIds, force = true)
                                                            if (ttResult.isSuccess) {
                                                                cache.saveTimetable(ttResult.getOrThrow())
                                                                cache.saveLastSyncTime(System.currentTimeMillis())
                                                            }
                                                        } catch (_: Exception) {}
                                                    }

                                                    withContext(Dispatchers.Main) {
                                                        configs = response.configs
                                                        activeConfigId = response.active_config_id
                                                        isLoading = false
                                                        isEditingUser = false
                                                    }
                                                } catch (e: Exception) {
                                                    withContext(Dispatchers.Main) {
                                                        errorMessage = e.message
                                                        isLoading = false
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    modifier = Modifier.weight(if (accountConfigured) 1.5f else 1f),
                                    shape = RoundedCornerShape(12.dp),
                                    enabled = !isLoading && username.isNotBlank()
                                ) {
                                    if (isLoading) {
                                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                    } else {
                                        Text("Conectar y cargar")
                                    }
                                }
                            }

                            if (errorMessage != null) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Error: $errorMessage",
                                    color = MaterialTheme.colorScheme.error,
                                    fontSize = 11.5.sp
                                )
                            }
                        }
                    }
                }
            }

            // 4. Selección de Configuración de Horario
            if (configs.isNotEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Horario del widget",
                                fontSize = 14.5.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 10.dp)
                            )

                            val isFollowActive = (selectedConfigId == null)
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isFollowActive) Color(0xFF4F6EF7).copy(alpha = 0.08f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                border = BorderStroke(
                                    width = if (isFollowActive) 1.5.dp else 1.dp,
                                    color = if (isFollowActive) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedConfigId = null }
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    RadioButton(
                                        selected = isFollowActive,
                                        onClick = { selectedConfigId = null },
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Text(
                                            text = "Seguir horario activo",
                                            fontWeight = if (isFollowActive) FontWeight.Bold else FontWeight.Medium,
                                            fontSize = 13.5.sp
                                        )
                                        val activeName = configs.find { it.id == activeConfigId }?.name ?: "Principal"
                                        Text(
                                            text = "Activo ahora: $activeName",
                                            fontSize = 11.5.sp,
                                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                        )
                                    }
                                }
                            }

                            configs.forEach { cfg ->
                                val isSelected = (selectedConfigId == cfg.id)
                                Spacer(modifier = Modifier.height(6.dp))
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = if (isSelected) Color(0xFF4F6EF7).copy(alpha = 0.08f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                    border = BorderStroke(
                                        width = if (isSelected) 1.5.dp else 1.dp,
                                        color = if (isSelected) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                                    ),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { selectedConfigId = cfg.id }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        RadioButton(
                                            selected = isSelected,
                                            onClick = { selectedConfigId = cfg.id },
                                            modifier = Modifier.size(20.dp)
                                        )
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = cfg.name,
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                                fontSize = 13.5.sp
                                            )
                                            Text(
                                                text = "${cfg.selectedGroups.size} grupo(s) configurado(s)",
                                                fontSize = 11.5.sp,
                                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 5. Modo de Visualización (Diaria vs Semanal)
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Modo de visualización",
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 10.dp)
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            val isDay = (widgetViewMode == "DAY")
                            val isWeek = (widgetViewMode == "WEEK")

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isDay) Color(0xFF4F6EF7).copy(alpha = 0.12f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                border = BorderStroke(
                                    width = if (isDay) 1.5.dp else 1.dp,
                                    color = if (isDay) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { widgetViewMode = "DAY" }
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 12.dp, horizontal = 8.dp),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_view_day),
                                        contentDescription = null,
                                        modifier = Modifier.size(17.dp),
                                        tint = if (isDay) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Vista diaria",
                                        fontWeight = if (isDay) FontWeight.Bold else FontWeight.Medium,
                                        fontSize = 13.sp,
                                        color = if (isDay) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isWeek) Color(0xFF4F6EF7).copy(alpha = 0.12f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                border = BorderStroke(
                                    width = if (isWeek) 1.5.dp else 1.dp,
                                    color = if (isWeek) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { widgetViewMode = "WEEK" }
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 12.dp, horizontal = 8.dp),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        painter = painterResource(id = R.drawable.ic_view_week),
                                        contentDescription = null,
                                        modifier = Modifier.size(17.dp),
                                        tint = if (isWeek) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Semana completa",
                                        fontWeight = if (isWeek) FontWeight.Bold else FontWeight.Medium,
                                        fontSize = 13.sp,
                                        color = if (isWeek) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 6. Tema y Apariencia
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Tema y apariencia",
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 10.dp)
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            val themes = listOf(
                                Triple("AUTO", "Sistema", R.drawable.ic_theme_auto),
                                Triple("LIGHT", "Claro", R.drawable.ic_theme_light),
                                Triple("DARK", "Oscuro", R.drawable.ic_theme_dark)
                            )

                            themes.forEach { (mode, label, iconRes) ->
                                val isSelected = (themeMode == mode)
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = if (isSelected) Color(0xFF4F6EF7).copy(alpha = 0.12f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                    border = BorderStroke(
                                        width = if (isSelected) 1.5.dp else 1.dp,
                                        color = if (isSelected) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                                    ),
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable { themeMode = mode }
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 12.dp, horizontal = 4.dp),
                                        horizontalArrangement = Arrangement.Center,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(
                                            painter = painterResource(id = iconRes),
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp),
                                            tint = if (isSelected) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)
                                        )
                                        Spacer(modifier = Modifier.width(5.dp))
                                        Text(
                                            text = label,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                            fontSize = 12.sp,
                                            color = if (isSelected) Color(0xFF4F6EF7) else MaterialTheme.colorScheme.onSurface
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}
