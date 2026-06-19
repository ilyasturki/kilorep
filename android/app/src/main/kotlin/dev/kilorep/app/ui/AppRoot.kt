package dev.kilorep.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dev.kilorep.app.AppContainer
import dev.kilorep.app.ui.components.BottomTab
import dev.kilorep.app.ui.components.LiftBottomBar
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.screens.BodyweightScreen
import dev.kilorep.app.ui.screens.DashboardScreen
import dev.kilorep.app.ui.screens.ExerciseDetailScreen
import dev.kilorep.app.ui.screens.ExerciseEditorScreen
import dev.kilorep.app.ui.screens.ExercisesScreen
import dev.kilorep.app.ui.screens.OnboardingScreen
import dev.kilorep.app.ui.screens.OnboardingViewModel
import dev.kilorep.app.ui.screens.SessionEditorScreen
import dev.kilorep.app.ui.screens.SessionEditorViewModel
import dev.kilorep.app.ui.screens.SessionsScreen
import dev.kilorep.app.ui.screens.SettingsScreen
import dev.kilorep.app.ui.screens.WorkoutScreen
import dev.kilorep.app.ui.screens.WorkoutViewModel
import dev.kilorep.app.ui.screens.WorkoutsScreen
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcon
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftTheme
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import kotlinx.coroutines.launch

private val TABS = listOf(
    BottomTab("dashboard", "Dashboard", LiftIcons.Grid),
    BottomTab("workouts", "Workouts", LiftIcons.Barbell),
    BottomTab("sessions", "Sessions", LiftIcons.ListDetails),
    BottomTab("exercises", "Exercises", LiftIcons.Search),
)

@Composable
fun AppRoot(container: AppContainer) {
    LiftTheme {
        val settings = container.settings.flow.watch()
        if (!settings.ready) {
            // First run, revoked token, or switched instance.
            OnboardingScreen(
                viewModel = viewModel {
                    OnboardingViewModel(container.settings, container.backend, container.repo)
                },
            )
        } else {
            MainNav(container)
        }
    }
}

@Composable
private fun MainNav(container: AppContainer) {
    val navController = rememberNavController()
    val online = container.connectivity.online.watch()
    val offline = !online
    val repo = container.repo
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    fun openDraft(localId: String) = navController.navigate("workout/$localId")
    fun openServerWorkout(id: Int) = scope.launch {
        repo.openWorkout(id).onSuccess { openDraft(it.localId) }
    }
    // Tab navigation that keeps a single back-stack entry per tab and restores
    // its scroll/state — shared by the bottom bar and in-page "see all" links.
    fun selectTab(route: String) = navController.navigate(route) {
        popUpTo("dashboard") { saveState = true }
        launchSingleTop = true
        restoreState = true
    }

    Column(Modifier.fillMaxSize().background(Lift.colors.bg)) {
        Box(Modifier.weight(1f)) {
            NavHost(
                navController = navController,
                startDestination = "dashboard",
            ) {
                composable("dashboard") {
                    DashboardScreen(
                        repo = repo,
                        offline = offline,
                        onOpenDraft = ::openDraft,
                        onOpenServerWorkout = { openServerWorkout(it) },
                        onOpenExercise = { navController.navigate("exercise/$it") },
                        onSeeAllWorkouts = { selectTab("workouts") },
                        onProfile = { navController.navigate("profile") },
                    )
                }
                composable("workouts") {
                    WorkoutsScreen(
                        repo = repo,
                        offline = offline,
                        onOpenDraft = ::openDraft,
                        onOpenServerWorkout = { openServerWorkout(it) },
                    )
                }
                composable("sessions") {
                    SessionsScreen(
                        repo = repo,
                        offline = offline,
                        onEdit = { id ->
                            navController.navigate(
                                if (id == null) "session-editor" else "session-editor?id=$id",
                            )
                        },
                    )
                }
                composable("exercises") {
                    ExercisesScreen(
                        repo = repo,
                        offline = offline,
                        onOpen = { navController.navigate("exercise/$it") },
                        onCreate = { navController.navigate("exercise-editor") },
                    )
                }
                composable("profile") {
                    ProfileScreen(
                        onBodyweight = { navController.navigate("bodyweight") },
                        onSettings = { navController.navigate("settings") },
                        onBack = { navController.popBackStack() },
                        offline = offline,
                    )
                }
                composable(
                    "workout/{localId}",
                    arguments = listOf(navArgument("localId") { type = NavType.StringType }),
                ) { entry ->
                    val localId = entry.arguments?.getString("localId") ?: return@composable
                    WorkoutScreen(
                        viewModel = viewModel(key = "workout-$localId") {
                            WorkoutViewModel(repo, localId)
                        },
                        exercises = repo.exercises.watch(),
                        offline = offline,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    "session-editor?id={id}",
                    arguments = listOf(
                        navArgument("id") {
                            type = NavType.StringType
                            nullable = true
                            defaultValue = null
                        },
                    ),
                ) { entry ->
                    val id = entry.arguments?.getString("id")?.toIntOrNull()
                    SessionEditorScreen(
                        viewModel = viewModel(key = "session-editor-${id ?: "new"}") {
                            SessionEditorViewModel(repo, id)
                        },
                        exercises = repo.exercises.watch(),
                        onBack = { navController.popBackStack() },
                    )
                }
                composable("session-editor") {
                    SessionEditorScreen(
                        viewModel = viewModel(key = "session-editor-new") {
                            SessionEditorViewModel(repo, null)
                        },
                        exercises = repo.exercises.watch(),
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    "exercise/{id}",
                    arguments = listOf(navArgument("id") { type = NavType.IntType }),
                ) { entry ->
                    val id = entry.arguments?.getInt("id") ?: return@composable
                    ExerciseDetailScreen(
                        repo = repo,
                        exerciseId = id,
                        offline = offline,
                        onEdit = { navController.navigate("exercise-editor?id=$id") },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    "exercise-editor?id={id}",
                    arguments = listOf(
                        navArgument("id") {
                            type = NavType.StringType
                            nullable = true
                            defaultValue = null
                        },
                    ),
                ) { entry ->
                    ExerciseEditorScreen(
                        repo = repo,
                        exerciseId = entry.arguments?.getString("id")?.toIntOrNull(),
                        onBack = { navController.popBackStack() },
                    )
                }
                composable("exercise-editor") {
                    ExerciseEditorScreen(
                        repo = repo,
                        exerciseId = null,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable("bodyweight") {
                    BodyweightScreen(
                        repo = repo,
                        offline = offline,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable("settings") {
                    SettingsScreen(
                        settings = container.settings,
                        repo = repo,
                        offline = offline,
                        onBack = { navController.popBackStack() },
                    )
                }
            }
        }
        // The gym loop is immersive: no tab bar competing with the finish bar.
        if (TABS.any { it.route == currentRoute }) {
            LiftBottomBar(
                tabs = TABS,
                currentRoute = currentRoute,
                onSelect = { selectTab(it) },
            )
        }
    }
}

@Composable
private fun ProfileScreen(
    onBodyweight: () -> Unit,
    onSettings: () -> Unit,
    onBack: () -> Unit,
    offline: Boolean,
) {
    LiftScreen(title = "Profile", onBack = onBack, offline = offline) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            MoreRow("Bodyweight", "Weigh-ins and trend", LiftIcons.Scale, onBodyweight)
            MoreRow("Settings", "Server, sync, account", LiftIcons.Settings, onSettings)
        }
    }
}

@Composable
private fun MoreRow(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
) {
    val colors = Lift.colors
    LiftCard(padding = 16.dp) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LiftIcon(icon, tint = colors.accentText)
            Column(Modifier.weight(1f)) {
                Text(title, style = LiftType.rowTitle)
                Text(subtitle, style = LiftType.secondary, color = colors.ink2)
            }
            LiftIcon(LiftIcons.ChevronRight, tint = colors.ink3, size = 17.dp)
        }
    }
}
