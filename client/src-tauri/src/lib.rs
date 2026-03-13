mod db;

use db::cache::CacheDb;
use tauri::Manager;

#[tauri::command]
async fn snap_to_edge(window: tauri::Window) -> Result<(), String> {
    let win_pos = window.outer_position().map_err(|e| e.to_string())?;
    let win_size = window.outer_size().map_err(|e| e.to_string())?;

    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;

    let monitor_pos = monitor.position();
    let monitor_size = monitor.size();
    let scale = monitor.scale_factor();

    let threshold = 20i32;

    let mut x = win_pos.x;
    let mut y = win_pos.y;
    let win_w = win_size.width as i32;
    let win_h = win_size.height as i32;
    let mon_x = monitor_pos.x;
    let mon_y = monitor_pos.y;
    let mon_w = (monitor_size.width as f64 / scale) as i32;
    let mon_h = (monitor_size.height as f64 / scale) as i32;

    let mut snapped = false;

    // Left edge
    if (x - mon_x).abs() < threshold {
        x = mon_x;
        snapped = true;
    }
    // Right edge
    if ((x + win_w) - (mon_x + mon_w)).abs() < threshold {
        x = mon_x + mon_w - win_w;
        snapped = true;
    }
    // Top edge
    if (y - mon_y).abs() < threshold {
        y = mon_y;
        snapped = true;
    }
    // Bottom edge
    if ((y + win_h) - (mon_y + mon_h)).abs() < threshold {
        y = mon_y + mon_h - win_h;
        snapped = true;
    }

    if snapped {
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x,
                y,
            }))
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn cache_tasks(state: tauri::State<'_, CacheDb>, tasks_json: String) -> Result<(), String> {
    state.cache_tasks(&tasks_json)
}

#[tauri::command]
async fn get_cached_tasks(state: tauri::State<'_, CacheDb>) -> Result<String, String> {
    state.get_cached_tasks()
}

#[tauri::command]
async fn queue_offline_op(
    state: tauri::State<'_, CacheDb>,
    entity_type: String,
    entity_id: String,
    action: String,
    payload: String,
) -> Result<(), String> {
    state.queue_offline_op(&entity_type, &entity_id, &action, &payload)
}

#[tauri::command]
async fn get_offline_queue(state: tauri::State<'_, CacheDb>) -> Result<String, String> {
    state.get_offline_queue()
}

#[tauri::command]
async fn clear_offline_queue(state: tauri::State<'_, CacheDb>, up_to_id: i64) -> Result<(), String> {
    state.clear_offline_queue(up_to_id)
}

#[tauri::command]
async fn cache_categories(state: tauri::State<'_, CacheDb>, categories_json: String) -> Result<(), String> {
    state.cache_categories(&categories_json)
}

#[tauri::command]
async fn get_cached_categories(state: tauri::State<'_, CacheDb>) -> Result<String, String> {
    state.get_cached_categories()
}

#[tauri::command]
async fn get_settings(state: tauri::State<'_, CacheDb>) -> Result<String, String> {
    let server_url = state.get_setting("server_url")?
        .unwrap_or_else(|| "http://localhost:3001".to_string());
    let bg_opacity = state.get_setting("bg_opacity")?
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(1.0);
    let theme = state.get_setting("theme")?
        .unwrap_or_else(|| "dark".to_string());
    Ok(serde_json::json!({ "server_url": server_url, "bg_opacity": bg_opacity, "theme": theme }).to_string())
}

#[tauri::command]
async fn save_settings(state: tauri::State<'_, CacheDb>, settings_json: String) -> Result<(), String> {
    let settings: serde_json::Value = serde_json::from_str(&settings_json)
        .map_err(|e| e.to_string())?;
    if let Some(url) = settings["server_url"].as_str() {
        state.set_setting("server_url", url)?;
    }
    if let Some(opacity) = settings["bg_opacity"].as_f64() {
        state.set_setting("bg_opacity", &opacity.to_string())?;
    }
    if let Some(theme) = settings["theme"].as_str() {
        state.set_setting("theme", theme)?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
      let cache_db = CacheDb::new(app_dir).expect("Failed to initialize cache DB");
      app.manage(cache_db);

      Ok(())
    })
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      snap_to_edge,
      cache_tasks,
      get_cached_tasks,
      cache_categories,
      get_cached_categories,
      queue_offline_op,
      get_offline_queue,
      clear_offline_queue,
      get_settings,
      save_settings,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
