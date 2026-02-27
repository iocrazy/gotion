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
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![snap_to_edge])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
