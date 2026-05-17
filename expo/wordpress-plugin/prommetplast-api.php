<?php
/**
 * Plugin Name: ПромМетПласт — Мобильное приложение API
 * Description: REST API эндпоинты для мобильного приложения. Мультигородской парсинг цен с сайта + управление через админку.
 * Version: 3.0.0
 * Author: ПромМетПласт
 */

if (!defined('ABSPATH')) exit;

// =============================================
// КОНФИГУРАЦИЯ: РЕГИОНЫ И ГОРОДА
// =============================================

function pmp_get_regions_config() {
    return [
        'altai' => [
            'label' => 'Алтайский край',
            'url' => 'https://xn--80ajscakgeerhe.xn--p1ai/',
            'fallback_url' => 'https://xn--80ajscakgeerhe.xn--p1ai/novosibirsk/',
            'tab_widget_index' => 0,
            'cities' => [
                'barnaul'     => ['label' => 'Барнаул',     'tab_id' => 'barnaul',     'data_tab' => 1, 'city_app_id' => '1'],
                'rubcovsk'    => ['label' => 'Рубцовск',    'tab_id' => 'rubcovsk',    'data_tab' => 2, 'city_app_id' => '2'],
                'zarinsk'     => ['label' => 'Заринск',     'tab_id' => 'zarinsk',     'data_tab' => 3, 'city_app_id' => '3'],
                'aleisk'      => ['label' => 'Алейск',      'tab_id' => 'aleisk',      'data_tab' => 4, 'city_app_id' => '4'],
                'novoaltaisk' => ['label' => 'Новоалтайск', 'tab_id' => 'novoaltaisk', 'data_tab' => 5, 'city_app_id' => '5'],
                'pospliha'    => ['label' => 'Поспелиха',   'tab_id' => 'pospliha',    'data_tab' => 6, 'city_app_id' => '6'],
            ],
        ],
        'novosibirsk' => [
            'label' => 'Новосибирская область',
            'url' => 'https://xn--80ajscakgeerhe.xn--p1ai/novosibirsk/',
            'fallback_url' => null,
            'tab_widget_index' => 0,
            'cities' => [
                'iskitim'      => ['label' => 'Искитим',              'tab_id' => 'iskitim', 'data_tab' => 1, 'city_app_id' => '7'],
                'novosib_main' => ['label' => 'Новосибирск (Главный)', 'tab_id' => 'novosib', 'data_tab' => 2, 'city_app_id' => '8'],
                'novosib'      => ['label' => 'Новосибирск',          'tab_id' => 'novosib', 'data_tab' => 3, 'city_app_id' => '9'],
            ],
        ],
    ];
}

function pmp_get_all_cities_flat() {
    $cities = [];
    foreach (pmp_get_regions_config() as $region_key => $region) {
        foreach ($region['cities'] as $city_key => $city) {
            $cities[$city['city_app_id']] = [
                'key' => $city_key,
                'label' => $city['label'],
                'region' => $region['label'],
                'region_key' => $region_key,
            ];
        }
    }
    return $cities;
}

function pmp_get_city_request_emails() {
    return [
        '1' => 'terra-barnaul@mail.ru', // Барнаул
        '2' => 'terra-barnaul@mail.ru', // Рубцовск
        '3' => 'terra-barnaul@mail.ru', // Заринск
        '4' => 'terra-barnaul@mail.ru', // Алейск
        '5' => 'terra-barnaul@mail.ru', // Новоалтайск
        '6' => 'terra-barnaul@mail.ru', // Поспелиха
        '7' => 'terra-barnaul@mail.ru', // Искитим
        '8' => 'Avion.54@mail.ru',      // Новосибирск (Главный)
        '9' => 'Avion.54@mail.ru',      // Новосибирск
    ];
}

function pmp_get_request_email_by_city($city_id) {
    $emails = pmp_get_city_request_emails();
    return $emails[$city_id] ?? get_option('admin_email');
}

// =============================================
// 1. РЕГИСТРАЦИЯ КАСТОМНЫХ ТИПОВ ЗАПИСЕЙ
// =============================================

add_action('init', 'pmp_register_post_types');
function pmp_register_post_types() {
    register_post_type('pmp_metal', [
        'labels' => [
            'name' => 'Цены на металл',
            'singular_name' => 'Металл',
            'add_new' => 'Добавить металл',
            'add_new_item' => 'Добавить новый металл',
            'edit_item' => 'Редактировать металл',
            'all_items' => 'Все металлы',
            'menu_name' => 'Цены на металл',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'menu_icon' => 'dashicons-chart-line',
        'supports' => ['title'],
        'show_in_rest' => true,
    ]);

    register_post_type('pmp_location', [
        'labels' => [
            'name' => 'Пункты приёма',
            'singular_name' => 'Пункт приёма',
            'add_new' => 'Добавить пункт',
            'add_new_item' => 'Добавить новый пункт',
            'edit_item' => 'Редактировать пункт',
            'all_items' => 'Все пункты',
            'menu_name' => 'Пункты приёма',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'menu_icon' => 'dashicons-location',
        'supports' => ['title'],
        'show_in_rest' => true,
    ]);

    register_post_type('pmp_vacancy', [
        'labels' => [
            'name' => 'Вакансии',
            'singular_name' => 'Вакансия',
            'add_new' => 'Добавить вакансию',
            'add_new_item' => 'Добавить новую вакансию',
            'edit_item' => 'Редактировать вакансию',
            'all_items' => 'Все вакансии',
            'menu_name' => 'Вакансии',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'menu_icon' => 'dashicons-businessman',
        'supports' => ['title'],
        'show_in_rest' => true,
    ]);

    register_post_type('pmp_request', [
        'labels' => [
            'name' => 'Заявки',
            'singular_name' => 'Заявка',
            'all_items' => 'Все заявки',
            'menu_name' => 'Заявки из приложения',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'menu_icon' => 'dashicons-email-alt',
        'supports' => ['title'],
        'show_in_rest' => false,
        'capabilities' => [
            'create_posts' => false,
        ],
        'map_meta_cap' => true,
    ]);
}

// =============================================
// 2. МЕТА-ПОЛЯ
// =============================================

add_action('add_meta_boxes', 'pmp_add_meta_boxes');
function pmp_add_meta_boxes() {
    add_meta_box('pmp_metal_fields', 'Параметры металла', 'pmp_metal_fields_cb', 'pmp_metal', 'normal', 'high');
    add_meta_box('pmp_metal_city_prices', 'Цены по городам (JSON)', 'pmp_metal_city_prices_cb', 'pmp_metal', 'normal', 'default');
    add_meta_box('pmp_location_fields', 'Параметры пункта', 'pmp_location_fields_cb', 'pmp_location', 'normal', 'high');
    add_meta_box('pmp_vacancy_fields', 'Параметры вакансии', 'pmp_vacancy_fields_cb', 'pmp_vacancy', 'normal', 'high');
    add_meta_box('pmp_request_fields', 'Данные заявки', 'pmp_request_fields_cb', 'pmp_request', 'normal', 'high');
}

function pmp_metal_fields_cb($post) {
    wp_nonce_field('pmp_metal_save', 'pmp_metal_nonce');
    $synced = get_post_meta($post->ID, '_pmp_synced', true);
    if ($synced) {
        echo '<div style="background:#fff3cd;border:1px solid #ffc107;padding:8px 12px;margin-bottom:10px;border-radius:4px;">⚡ Эта запись создана автоматически парсером. Ручные изменения будут перезаписаны при следующей синхронизации.</div>';
    }
    $fields = [
        'category' => ['Категория (ferrous / non-ferrous)', get_post_meta($post->ID, '_pmp_category', true) ?: 'non-ferrous'],
        'price_card_upto_50' => ['Цена: карта физл. до 50кг (Барнаул)', get_post_meta($post->ID, '_pmp_price_card_upto_50', true) ?: ''],
        'price_card_from_50' => ['Цена: на карту физл. от 50кг (Барнаул)', get_post_meta($post->ID, '_pmp_price_card_from_50', true) ?: ''],
        'price_account_legal' => ['Цена: счёт юрл. (Барнаул)', get_post_meta($post->ID, '_pmp_price_account_legal', true) ?: ''],
        'price' => ['Цена за кг (основная, совместимость)', get_post_meta($post->ID, '_pmp_price', true) ?: ''],
        'previous_price' => ['Предыдущая цена', get_post_meta($post->ID, '_pmp_previous_price', true) ?: ''],
        'color' => ['Цвет (HEX)', get_post_meta($post->ID, '_pmp_color', true) ?: '#B87333'],
        'description' => ['Описание', get_post_meta($post->ID, '_pmp_description', true) ?: ''],
        'sort_order' => ['Порядок сортировки', get_post_meta($post->ID, '_pmp_sort_order', true) ?: '0'],
    ];
    echo '<table class="form-table">';
    foreach ($fields as $key => [$label, $value]) {
        echo '<tr><th><label>' . esc_html($label) . '</label></th>';
        if ($key === 'category') {
            echo '<td><select name="pmp_' . $key . '">';
            echo '<option value="non-ferrous"' . selected($value, 'non-ferrous', false) . '>Цветной</option>';
            echo '<option value="ferrous"' . selected($value, 'ferrous', false) . '>Чёрный</option>';
            echo '</select></td>';
        } else {
            echo '<td><input type="text" name="pmp_' . $key . '" value="' . esc_attr($value) . '" class="regular-text" /></td>';
        }
        echo '</tr>';
    }
    echo '</table>';
}

function pmp_metal_city_prices_cb($post) {
    $prices_json = get_post_meta($post->ID, '_pmp_prices_by_city', true);
    $prices = $prices_json ? json_decode($prices_json, true) : [];
    $cities = pmp_get_all_cities_flat();

    if (empty($prices)) {
        echo '<p style="color:#666;">Цены по городам ещё не заполнены. Запустите синхронизацию.</p>';
        return;
    }

    echo '<table class="widefat fixed striped" style="margin-top:8px;">';
    echo '<thead><tr><th>Город</th><th>Регион</th><th>До 50кг (карта)</th><th>От 50кг (карта)</th><th>Юрлица (счёт)</th></tr></thead>';
    echo '<tbody>';
    foreach ($prices as $city_id => $city_prices) {
        $city_info = $cities[$city_id] ?? null;
        $city_label = $city_info ? $city_info['label'] : "ID: $city_id";
        $region_label = $city_info ? $city_info['region'] : '—';
        $upto50 = isset($city_prices['priceCardUpto50']) ? $city_prices['priceCardUpto50'] . ' ₽' : '—';
        $from50 = isset($city_prices['priceCardFrom50']) ? $city_prices['priceCardFrom50'] . ' ₽' : '—';
        $legal = isset($city_prices['priceAccountLegal']) ? $city_prices['priceAccountLegal'] . ' ₽' : '—';
        echo "<tr><td><strong>$city_label</strong></td><td>$region_label</td><td>$upto50</td><td>$from50</td><td>$legal</td></tr>";
    }
    echo '</tbody></table>';

    echo '<div style="margin-top:10px;">';
    echo '<label><strong>Редактировать JSON (для продвинутых):</strong></label>';
    echo '<textarea name="pmp_prices_by_city_json" rows="6" class="large-text" style="font-family:monospace;font-size:12px;">' . esc_textarea($prices_json) . '</textarea>';
    echo '</div>';
}

function pmp_location_fields_cb($post) {
    wp_nonce_field('pmp_location_save', 'pmp_location_nonce');
    $synced = get_post_meta($post->ID, '_pmp_synced', true);
    if ($synced) {
        echo '<div style="background:#fff3cd;border:1px solid #ffc107;padding:8px 12px;margin-bottom:10px;border-radius:4px;">⚡ Эта запись создана автоматически парсером.</div>';
    }
    $fields = [
        'address' => ['Адрес', get_post_meta($post->ID, '_pmp_address', true) ?: ''],
        'phone' => ['Телефон', get_post_meta($post->ID, '_pmp_phone', true) ?: ''],
        'working_hours' => ['Часы работы', get_post_meta($post->ID, '_pmp_working_hours', true) ?: ''],
        'is_main' => ['Главный офис (1/0)', get_post_meta($post->ID, '_pmp_is_main', true) ?: '0'],
        'latitude' => ['Широта', get_post_meta($post->ID, '_pmp_latitude', true) ?: ''],
        'longitude' => ['Долгота', get_post_meta($post->ID, '_pmp_longitude', true) ?: ''],
    ];
    echo '<table class="form-table">';
    foreach ($fields as $key => [$label, $value]) {
        echo '<tr><th><label>' . esc_html($label) . '</label></th>';
        echo '<td><input type="text" name="pmp_' . $key . '" value="' . esc_attr($value) . '" class="regular-text" /></td></tr>';
    }
    echo '</table>';
}

function pmp_vacancy_fields_cb($post) {
    wp_nonce_field('pmp_vacancy_save', 'pmp_vacancy_nonce');
    $synced = get_post_meta($post->ID, '_pmp_synced', true);
    if ($synced) {
        echo '<div style="background:#fff3cd;border:1px solid #ffc107;padding:8px 12px;margin-bottom:10px;border-radius:4px;">⚡ Эта запись создана автоматически парсером.</div>';
    }
    $fields = [
        'salary' => ['Зарплата', get_post_meta($post->ID, '_pmp_salary', true) ?: ''],
        'description' => ['Описание', get_post_meta($post->ID, '_pmp_vac_description', true) ?: ''],
        'requirements' => ['Требования (каждое с новой строки)', get_post_meta($post->ID, '_pmp_requirements', true) ?: ''],
        'location' => ['Город', get_post_meta($post->ID, '_pmp_vac_location', true) ?: ''],
    ];
    echo '<table class="form-table">';
    foreach ($fields as $key => [$label, $value]) {
        echo '<tr><th><label>' . esc_html($label) . '</label></th>';
        if ($key === 'requirements' || $key === 'description') {
            echo '<td><textarea name="pmp_' . $key . '" rows="4" class="large-text">' . esc_textarea($value) . '</textarea></td>';
        } else {
            echo '<td><input type="text" name="pmp_' . $key . '" value="' . esc_attr($value) . '" class="regular-text" /></td>';
        }
        echo '</tr>';
    }
    echo '</table>';
}

function pmp_request_fields_cb($post) {
    $meta_keys = ['_pmp_req_name', '_pmp_req_phone', '_pmp_req_city', '_pmp_req_metal', '_pmp_req_weight', '_pmp_req_address', '_pmp_req_comment'];
    $labels = ['Имя', 'Телефон', 'Город', 'Тип металла', 'Вес (кг)', 'Адрес', 'Комментарий'];
    echo '<table class="form-table">';
    foreach ($meta_keys as $i => $key) {
        $val = get_post_meta($post->ID, $key, true);
        echo '<tr><th>' . esc_html($labels[$i]) . '</th><td><strong>' . esc_html($val ?: '—') . '</strong></td></tr>';
    }
    echo '</table>';
}

// =============================================
// 3. СОХРАНЕНИЕ МЕТА-ПОЛЕЙ
// =============================================

add_action('save_post_pmp_metal', 'pmp_save_metal');
function pmp_save_metal($post_id) {
    if (!isset($_POST['pmp_metal_nonce']) || !wp_verify_nonce($_POST['pmp_metal_nonce'], 'pmp_metal_save')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    $fields = ['category', 'price', 'previous_price', 'price_card_upto_50', 'price_card_from_50', 'price_account_legal', 'color', 'description', 'sort_order'];
    foreach ($fields as $f) {
        if (isset($_POST['pmp_' . $f])) {
            update_post_meta($post_id, '_pmp_' . $f, sanitize_text_field($_POST['pmp_' . $f]));
        }
    }
    if (isset($_POST['pmp_prices_by_city_json'])) {
        $json = wp_unslash($_POST['pmp_prices_by_city_json']);
        $decoded = json_decode($json, true);
        if ($decoded !== null) {
            update_post_meta($post_id, '_pmp_prices_by_city', wp_json_encode($decoded, JSON_UNESCAPED_UNICODE));
        }
    }
}

add_action('save_post_pmp_location', 'pmp_save_location');
function pmp_save_location($post_id) {
    if (!isset($_POST['pmp_location_nonce']) || !wp_verify_nonce($_POST['pmp_location_nonce'], 'pmp_location_save')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    $fields = ['address', 'phone', 'working_hours', 'is_main', 'latitude', 'longitude'];
    foreach ($fields as $f) {
        if (isset($_POST['pmp_' . $f])) {
            update_post_meta($post_id, '_pmp_' . $f, sanitize_text_field($_POST['pmp_' . $f]));
        }
    }
}

add_action('save_post_pmp_vacancy', 'pmp_save_vacancy');
function pmp_save_vacancy($post_id) {
    if (!isset($_POST['pmp_vacancy_nonce']) || !wp_verify_nonce($_POST['pmp_vacancy_nonce'], 'pmp_vacancy_save')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (isset($_POST['pmp_salary'])) update_post_meta($post_id, '_pmp_salary', sanitize_text_field($_POST['pmp_salary']));
    if (isset($_POST['pmp_description'])) update_post_meta($post_id, '_pmp_vac_description', sanitize_textarea_field($_POST['pmp_description']));
    if (isset($_POST['pmp_requirements'])) update_post_meta($post_id, '_pmp_requirements', sanitize_textarea_field($_POST['pmp_requirements']));
    if (isset($_POST['pmp_location'])) update_post_meta($post_id, '_pmp_vac_location', sanitize_text_field($_POST['pmp_location']));
}

// =============================================
// 4. REST API ЭНДПОИНТЫ
// =============================================

add_action('rest_api_init', 'pmp_register_api_routes');
function pmp_register_api_routes() {
    $namespace = 'pmp/v1';

    register_rest_route($namespace, '/metals', [
        'methods' => 'GET',
        'callback' => 'pmp_api_get_metals',
        'permission_callback' => '__return_true',
        'args' => [
            'city_id' => [
                'required' => false,
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'description' => 'ID города для получения городских цен (1-9)',
            ],
        ],
    ]);

    register_rest_route($namespace, '/metals/cities', [
        'methods' => 'GET',
        'callback' => 'pmp_api_get_metals_cities',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route($namespace, '/locations', [
        'methods' => 'GET',
        'callback' => 'pmp_api_get_locations',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route($namespace, '/vacancies', [
        'methods' => 'GET',
        'callback' => 'pmp_api_get_vacancies',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route($namespace, '/request', [
        'methods' => 'POST',
        'callback' => 'pmp_api_create_request',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route($namespace, '/settings', [
        'methods' => 'GET',
        'callback' => 'pmp_api_get_settings',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route($namespace, '/sync/status', [
        'methods' => 'GET',
        'callback' => 'pmp_api_get_sync_status',
        'permission_callback' => '__return_true',
    ]);
}

function pmp_api_get_metals($request) {
    $city_id = $request->get_param('city_id');

    $posts = get_posts([
        'post_type' => 'pmp_metal',
        'numberposts' => 200,
        'post_status' => 'publish',
        'orderby' => 'meta_value_num',
        'meta_key' => '_pmp_sort_order',
        'order' => 'ASC',
    ]);

    $result = [];
    foreach ($posts as $post) {
        $price = (float) get_post_meta($post->ID, '_pmp_price', true);
        $prev = (float) get_post_meta($post->ID, '_pmp_previous_price', true);
        $card_upto_50 = get_post_meta($post->ID, '_pmp_price_card_upto_50', true);
        $card_from_50 = get_post_meta($post->ID, '_pmp_price_card_from_50', true);
        $account_legal = get_post_meta($post->ID, '_pmp_price_account_legal', true);

        $item = [
            'id' => (string) $post->ID,
            'name' => $post->post_title,
            'category' => get_post_meta($post->ID, '_pmp_category', true) ?: 'non-ferrous',
            'pricePerKg' => $price,
            'previousPrice' => $prev ?: $price,
            'priceCardUpto50' => $card_upto_50 !== '' ? (float) $card_upto_50 : null,
            'priceCardFrom50' => $card_from_50 !== '' ? (float) $card_from_50 : null,
            'priceAccountLegal' => $account_legal !== '' ? (float) $account_legal : null,
            'unit' => 'rub/kg',
            'color' => get_post_meta($post->ID, '_pmp_color', true) ?: '#B87333',
            'icon' => 'metal',
            'description' => get_post_meta($post->ID, '_pmp_description', true) ?: '',
        ];

        if ($city_id) {
            $prices_json = get_post_meta($post->ID, '_pmp_prices_by_city', true);
            $prices_by_city = $prices_json ? json_decode($prices_json, true) : [];

            if (isset($prices_by_city[$city_id])) {
                $cp = $prices_by_city[$city_id];
                $item['priceCardUpto50'] = isset($cp['priceCardUpto50']) ? (float) $cp['priceCardUpto50'] : $item['priceCardUpto50'];
                $item['priceCardFrom50'] = isset($cp['priceCardFrom50']) ? (float) $cp['priceCardFrom50'] : $item['priceCardFrom50'];
                $item['priceAccountLegal'] = isset($cp['priceAccountLegal']) ? (float) $cp['priceAccountLegal'] : $item['priceAccountLegal'];
                $item['pricePerKg'] = $item['priceCardFrom50'] ?? $item['priceCardUpto50'] ?? $item['priceAccountLegal'] ?? $price;
            }

            $item['pricesByCity'] = null;
        } else {
            $prices_json = get_post_meta($post->ID, '_pmp_prices_by_city', true);
            $item['pricesByCity'] = $prices_json ? json_decode($prices_json, true) : null;
        }

        $result[] = $item;
    }

    return rest_ensure_response($result);
}

function pmp_api_get_metals_cities() {
    $cities = pmp_get_all_cities_flat();
    $result = [];
    foreach ($cities as $id => $city) {
        $result[] = [
            'id' => $id,
            'name' => $city['label'],
            'region' => $city['region'],
            'regionKey' => $city['region_key'],
        ];
    }
    return rest_ensure_response($result);
}

function pmp_api_get_locations() {
    $posts = get_posts([
        'post_type' => 'pmp_location',
        'numberposts' => 50,
        'post_status' => 'publish',
        'orderby' => 'menu_order',
        'order' => 'ASC',
    ]);

    $result = [];
    foreach ($posts as $post) {
        $result[] = [
            'id' => (string) $post->ID,
            'name' => $post->post_title,
            'address' => get_post_meta($post->ID, '_pmp_address', true) ?: '',
            'phone' => get_post_meta($post->ID, '_pmp_phone', true) ?: '',
            'workingHours' => get_post_meta($post->ID, '_pmp_working_hours', true) ?: '',
            'isMain' => get_post_meta($post->ID, '_pmp_is_main', true) === '1',
            'latitude' => (float) get_post_meta($post->ID, '_pmp_latitude', true),
            'longitude' => (float) get_post_meta($post->ID, '_pmp_longitude', true),
        ];
    }

    return rest_ensure_response($result);
}

function pmp_api_get_vacancies() {
    $posts = get_posts([
        'post_type' => 'pmp_vacancy',
        'numberposts' => 50,
        'post_status' => 'publish',
    ]);

    $result = [];
    foreach ($posts as $post) {
        $reqs_raw = get_post_meta($post->ID, '_pmp_requirements', true) ?: '';
        $reqs = array_filter(array_map('trim', explode("\n", $reqs_raw)));

        $result[] = [
            'id' => (string) $post->ID,
            'title' => $post->post_title,
            'salary' => get_post_meta($post->ID, '_pmp_salary', true) ?: '',
            'description' => get_post_meta($post->ID, '_pmp_vac_description', true) ?: '',
            'requirements' => array_values($reqs),
            'location' => get_post_meta($post->ID, '_pmp_vac_location', true) ?: '',
        ];
    }

    return rest_ensure_response($result);
}

function pmp_api_create_request($request) {
    $params = $request->get_json_params();

    $name = sanitize_text_field($params['name'] ?? '');
    $phone = sanitize_text_field($params['phone'] ?? '');
    $city = sanitize_text_field($params['city'] ?? '');
    $metal = sanitize_text_field($params['metalType'] ?? '');
    $weight = sanitize_text_field($params['estimatedWeight'] ?? '');
    $address = sanitize_text_field($params['address'] ?? '');
    $comment = sanitize_textarea_field($params['comment'] ?? '');

    if (empty($name) || empty($phone)) {
        return new WP_Error('missing_fields', 'Имя и телефон обязательны', ['status' => 400]);
    }

    $post_id = wp_insert_post([
        'post_type' => 'pmp_request',
        'post_title' => $name . ' — ' . $phone . ' (' . date('d.m.Y H:i') . ')',
        'post_status' => 'publish',
    ]);

    if (is_wp_error($post_id)) {
        return new WP_Error('create_failed', 'Ошибка создания заявки', ['status' => 500]);
    }

    update_post_meta($post_id, '_pmp_req_name', $name);
    update_post_meta($post_id, '_pmp_req_phone', $phone);
    update_post_meta($post_id, '_pmp_req_city', $city);
    update_post_meta($post_id, '_pmp_req_metal', $metal);
    update_post_meta($post_id, '_pmp_req_weight', $weight);
    update_post_meta($post_id, '_pmp_req_address', $address);
    update_post_meta($post_id, '_pmp_req_comment', $comment);

    $city_email = pmp_get_request_email_by_city($city);
    update_post_meta($post_id, '_pmp_req_email_to', $city_email);

    $cities = pmp_get_all_cities_flat();
    $city_label = $cities[$city]['label'] ?? $city;
    $subject = 'Новая заявка из приложения: ' . $name;
    $body = "Имя: $name\nТелефон: $phone\nГород: $city_label\nМеталл: $metal\nВес: $weight кг\nАдрес: $address\nКомментарий: $comment";
    wp_mail($city_email, $subject, $body);

    return rest_ensure_response([
        'success' => true,
        'id' => (string) $post_id,
        'message' => 'Заявка создана успешно',
    ]);
}

function pmp_api_get_settings() {
    return rest_ensure_response([
        'phone' => get_option('pmp_main_phone', '+7 (905) 982-39-45'),
        'companyName' => get_option('pmp_company_name', 'Промметпласт Группа компаний'),
        'region' => get_option('pmp_region', 'Алтайский край'),
        'website' => get_option('pmp_website', 'https://xn--80ajscakgeerhe.xn--p1ai/'),
        'minPickupWeight' => get_option('pmp_min_weight', '500'),
    ]);
}

function pmp_api_get_sync_status() {
    $regions = pmp_get_regions_config();
    $result = [];
    foreach ($regions as $key => $region) {
        $result[$key] = [
            'label' => $region['label'],
            'enabled' => get_option("pmp_sync_{$key}_enabled", '1') === '1',
            'lastSync' => get_option("pmp_last_sync_{$key}_time", ''),
            'lastLog' => get_option("pmp_last_sync_{$key}_log", ''),
            'citiesCount' => count($region['cities']),
        ];
    }
    return rest_ensure_response($result);
}

// =============================================
// 5. СТРАНИЦА НАСТРОЕК + ПАРСЕР
// =============================================

add_action('admin_menu', 'pmp_add_settings_page');
function pmp_add_settings_page() {
    add_options_page('Настройки приложения', 'Мобильное приложение', 'manage_options', 'pmp-settings', 'pmp_settings_page_cb');
}

function pmp_settings_page_cb() {
    $regions = pmp_get_regions_config();

    if (isset($_POST['pmp_save_settings']) && check_admin_referer('pmp_settings_nonce')) {
        update_option('pmp_main_phone', sanitize_text_field($_POST['pmp_main_phone'] ?? ''));
        update_option('pmp_company_name', sanitize_text_field($_POST['pmp_company_name'] ?? ''));
        update_option('pmp_region', sanitize_text_field($_POST['pmp_region'] ?? ''));
        update_option('pmp_website', esc_url_raw($_POST['pmp_website'] ?? ''));
        update_option('pmp_min_weight', sanitize_text_field($_POST['pmp_min_weight'] ?? '500'));
        update_option('pmp_sync_enabled', isset($_POST['pmp_sync_enabled']) ? '1' : '0');
        foreach ($regions as $rkey => $rdata) {
            update_option("pmp_sync_{$rkey}_enabled", isset($_POST["pmp_sync_{$rkey}_enabled"]) ? '1' : '0');
        }
        echo '<div class="updated"><p>Настройки сохранены!</p></div>';
    }

    if (isset($_POST['pmp_sync_now']) && check_admin_referer('pmp_settings_nonce')) {
        $sync_region = sanitize_text_field($_POST['pmp_sync_region'] ?? 'all');
        $result = pmp_run_sync($sync_region);
        if ($result['success']) {
            echo '<div class="updated"><p>✅ Синхронизация завершена! ' . esc_html($result['message']) . '</p></div>';
        } else {
            echo '<div class="error"><p>❌ Ошибка синхронизации: ' . esc_html($result['message']) . '</p></div>';
        }
    }

    $phone = get_option('pmp_main_phone', '+7 (905) 982-39-45');
    $company = get_option('pmp_company_name', 'Промметпласт Группа компаний');
    $region = get_option('pmp_region', 'Алтайский край');
    $website = get_option('pmp_website', 'https://xn--80ajscakgeerhe.xn--p1ai/');
    $min_weight = get_option('pmp_min_weight', '500');
    $sync_enabled = get_option('pmp_sync_enabled', '1');

    echo '<div class="wrap">';
    echo '<h1>Настройки мобильного приложения</h1>';

    echo '<div style="background:#f0f6fc;border:1px solid #c3d9ed;padding:15px 20px;margin:15px 0;border-radius:6px;">';
    echo '<h2 style="margin-top:0;">🔄 Мультигородская синхронизация цен</h2>';
    echo '<p style="color:#555;">Парсер автоматически собирает цены со всех вкладок (городов) на сайте. Каждый город — отдельная вкладка в Elementor (eael-adv-tabs).</p>';

    echo '<form method="post">';
    wp_nonce_field('pmp_settings_nonce');
    echo '<table class="form-table">';

    echo '<tr><th>Глобальная автосинхронизация (24ч)</th><td>';
    echo '<label><input type="checkbox" name="pmp_sync_enabled" value="1"' . checked($sync_enabled, '1', false) . ' /> Включить автоматический парсинг</label>';
    echo '</td></tr>';

    foreach ($regions as $rkey => $rdata) {
        $r_enabled = get_option("pmp_sync_{$rkey}_enabled", '1');
        $r_last_sync = get_option("pmp_last_sync_{$rkey}_time", '');
        $r_last_log = get_option("pmp_last_sync_{$rkey}_log", '');
        $cities_list = implode(', ', array_map(function($c) { return $c['label']; }, $rdata['cities']));

        echo '<tr><th colspan="2"><hr style="border:none;border-top:1px solid #ddd;" /></th></tr>';
        echo '<tr><th style="font-size:14px;">📍 ' . esc_html($rdata['label']) . '</th>';
        echo '<td>';
        echo '<label><input type="checkbox" name="pmp_sync_' . $rkey . '_enabled" value="1"' . checked($r_enabled, '1', false) . ' /> Парсить этот регион</label>';
        echo '<p class="description">Города: ' . esc_html($cities_list) . '</p>';
        echo '<p class="description">URL: <code>' . esc_html($rdata['url']) . '</code></p>';
        if ($r_last_sync) {
            echo '<p>Последняя синхронизация: <strong>' . esc_html($r_last_sync) . '</strong></p>';
        }
        if ($r_last_log) {
            echo '<details style="margin-top:5px;"><summary style="cursor:pointer;color:#0073aa;">Показать лог</summary>';
            echo '<pre style="background:#fff;padding:10px;border:1px solid #ddd;max-height:200px;overflow-y:auto;white-space:pre-wrap;font-size:12px;">' . esc_html($r_last_log) . '</pre>';
            echo '</details>';
        }
        echo '</td></tr>';
    }

    echo '</table>';

    echo '<p class="submit">';
    echo '<input type="submit" name="pmp_save_settings" class="button-primary" value="Сохранить настройки" /> ';
    echo '<input type="hidden" name="pmp_sync_region" value="all" />';
    echo '<input type="submit" name="pmp_sync_now" class="button-secondary" value="⚡ Синхронизировать ВСЕ регионы" onclick="this.form.pmp_sync_region.value=\'all\';return confirm(\'Запустить полную синхронизацию?\');" /> ';
    foreach ($regions as $rkey => $rdata) {
        echo '<input type="submit" name="pmp_sync_now" class="button" value="🔄 Только ' . esc_attr($rdata['label']) . '" onclick="this.form.pmp_sync_region.value=\'' . esc_attr($rkey) . '\';return confirm(\'Синхронизировать ' . esc_attr($rdata['label']) . '?\');" /> ';
    }
    echo '</p>';
    echo '</form>';
    echo '</div>';

    echo '<form method="post">';
    wp_nonce_field('pmp_settings_nonce');
    echo '<h2>Основные настройки</h2>';
    echo '<table class="form-table">';
    echo '<tr><th>Название компании</th><td><input type="text" name="pmp_company_name" value="' . esc_attr($company) . '" class="regular-text" /></td></tr>';
    echo '<tr><th>Основной телефон</th><td><input type="text" name="pmp_main_phone" value="' . esc_attr($phone) . '" class="regular-text" /></td></tr>';
    echo '<tr><th>Регион</th><td><input type="text" name="pmp_region" value="' . esc_attr($region) . '" class="regular-text" /></td></tr>';
    echo '<tr><th>Сайт</th><td><input type="url" name="pmp_website" value="' . esc_attr($website) . '" class="regular-text" /></td></tr>';
    echo '<tr><th>Мин. вес для вывоза (кг)</th><td><input type="text" name="pmp_min_weight" value="' . esc_attr($min_weight) . '" class="regular-text" /></td></tr>';
    echo '</table>';
    echo '<p class="submit"><input type="submit" name="pmp_save_settings" class="button-primary" value="Сохранить" /></p>';
    echo '</form>';

    echo '<hr/><h2>API Эндпоинты</h2><ul>';
    echo '<li><code>GET /wp-json/pmp/v1/metals</code> — Все цены (основной город)</li>';
    echo '<li><code>GET /wp-json/pmp/v1/metals?city_id=1</code> — Цены для конкретного города</li>';
    echo '<li><code>GET /wp-json/pmp/v1/metals/cities</code> — Список доступных городов</li>';
    echo '<li><code>GET /wp-json/pmp/v1/locations</code> — Пункты приёма</li>';
    echo '<li><code>GET /wp-json/pmp/v1/vacancies</code> — Вакансии</li>';
    echo '<li><code>GET /wp-json/pmp/v1/settings</code> — Настройки</li>';
    echo '<li><code>GET /wp-json/pmp/v1/sync/status</code> — Статус синхронизации</li>';
    echo '<li><code>POST /wp-json/pmp/v1/request</code> — Создание заявки</li>';
    echo '</ul>';

    echo '<h3>Маппинг городов</h3>';
    echo '<table class="widefat fixed striped" style="max-width:600px;">';
    echo '<thead><tr><th>city_id</th><th>Город</th><th>Регион</th></tr></thead><tbody>';
    foreach (pmp_get_all_cities_flat() as $id => $city) {
        echo "<tr><td><code>{$id}</code></td><td>{$city['label']}</td><td>{$city['region']}</td></tr>";
    }
    echo '</tbody></table>';
    echo '</div>';
}

// =============================================
// 6. CORS
// =============================================

add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        return $value;
    });
}, 15);

// =============================================
// 7. КОЛОНКИ В АДМИНКЕ
// =============================================

add_filter('manage_pmp_request_posts_columns', function($columns) {
    return ['cb' => $columns['cb'], 'title' => 'Заявка', 'pmp_phone' => 'Телефон', 'pmp_city' => 'Город', 'pmp_metal' => 'Металл', 'pmp_weight' => 'Вес', 'date' => 'Дата'];
});

add_action('manage_pmp_request_posts_custom_column', function($column, $post_id) {
    switch ($column) {
        case 'pmp_phone': echo esc_html(get_post_meta($post_id, '_pmp_req_phone', true)); break;
        case 'pmp_city': echo esc_html(get_post_meta($post_id, '_pmp_req_city', true)); break;
        case 'pmp_metal': echo esc_html(get_post_meta($post_id, '_pmp_req_metal', true)); break;
        case 'pmp_weight': echo esc_html(get_post_meta($post_id, '_pmp_req_weight', true)); break;
    }
}, 10, 2);

add_filter('manage_pmp_metal_posts_columns', function($columns) {
    return [
        'cb' => $columns['cb'],
        'title' => 'Название',
        'pmp_category' => 'Категория',
        'pmp_card_upto_50' => 'До 50кг',
        'pmp_card_from_50' => 'От 50кг',
        'pmp_account_legal' => 'Юрл.',
        'pmp_cities_count' => 'Городов',
        'pmp_synced' => 'Источник',
        'date' => 'Дата',
    ];
});

add_action('manage_pmp_metal_posts_custom_column', function($column, $post_id) {
    switch ($column) {
        case 'pmp_category': echo get_post_meta($post_id, '_pmp_category', true) === 'ferrous' ? 'Чёрный' : 'Цветной'; break;
        case 'pmp_card_upto_50': echo esc_html(get_post_meta($post_id, '_pmp_price_card_upto_50', true)) . ' ₽'; break;
        case 'pmp_card_from_50': echo esc_html(get_post_meta($post_id, '_pmp_price_card_from_50', true)) . ' ₽'; break;
        case 'pmp_account_legal': echo esc_html(get_post_meta($post_id, '_pmp_price_account_legal', true)) . ' ₽'; break;
        case 'pmp_cities_count':
            $json = get_post_meta($post_id, '_pmp_prices_by_city', true);
            $data = $json ? json_decode($json, true) : [];
            echo count($data) . ' / 9';
            break;
        case 'pmp_synced': echo get_post_meta($post_id, '_pmp_synced', true) ? '🔄 Парсер' : '✍️ Вручную'; break;
    }
}, 10, 2);

// =============================================
// 8. ПАРСЕР — МУЛЬТИГОРОДСКАЯ ЛОГИКА
// =============================================

function pmp_run_sync($target_region = 'all') {
    $regions = pmp_get_regions_config();
    $log = [];
    $log[] = '========================================';
    $log[] = 'Начало синхронизации: ' . date('d.m.Y H:i:s');
    $log[] = 'Режим: ' . ($target_region === 'all' ? 'все регионы' : $target_region);
    $log[] = '========================================';

    $all_metals_by_city = [];
    $total_metals_created = 0;
    $total_metals_updated = 0;

    foreach ($regions as $rkey => $rdata) {
        if ($target_region !== 'all' && $target_region !== $rkey) continue;
        if (get_option("pmp_sync_{$rkey}_enabled", '1') !== '1') {
            $log[] = "[{$rdata['label']}] Пропущен (отключен)";
            continue;
        }

        $rlog = [];
        $rlog[] = "--- Регион: {$rdata['label']} ---";
        $rlog[] = "URL: {$rdata['url']}";

        $html = pmp_fetch_page($rdata['url'], $rlog);

        if ($html === null && $rdata['fallback_url']) {
            $rlog[] = "Основной URL не отдал данные, пробуем fallback: {$rdata['fallback_url']}";
            $html = pmp_fetch_page($rdata['fallback_url'], $rlog);
        }

        if ($html === null) {
            $rlog[] = "ОШИБКА: Не удалось загрузить HTML для {$rdata['label']}";
            $region_log = implode("\n", $rlog);
            update_option("pmp_last_sync_{$rkey}_log", $region_log);
            update_option("pmp_last_sync_{$rkey}_time", date('d.m.Y H:i:s') . ' (ошибка)');
            $log = array_merge($log, $rlog);
            continue;
        }

        $rlog[] = "HTML загружен: " . strlen($html) . " байт";

        $tabs_data = pmp_extract_tabs($html, $rlog);
        $rlog[] = "Найдено вкладок (eael-tabs): " . count($tabs_data);

        foreach ($rdata['cities'] as $city_key => $city_config) {
            $city_id = $city_config['city_app_id'];
            $tab_id = $city_config['tab_id'];
            $data_tab = $city_config['data_tab'];

            $tab_html = pmp_find_tab_content($tabs_data, $tab_id, $data_tab, $rlog);

            if ($tab_html === null) {
                $rlog[] = "  [{$city_config['label']}] Вкладка не найдена (tab_id={$tab_id}, data_tab={$data_tab})";
                continue;
            }

            $metals = pmp_parse_metals_from_html($tab_html, $rlog, $city_config['label']);
            $rlog[] = "  [{$city_config['label']}] Найдено металлов: " . count($metals);

            foreach ($metals as $metal) {
                $metal_name = $metal['name'];
                if (!isset($all_metals_by_city[$metal_name])) {
                    $all_metals_by_city[$metal_name] = [
                        'category' => $metal['category'],
                        'color' => $metal['color'],
                        'cities' => [],
                    ];
                }
                $all_metals_by_city[$metal_name]['cities'][$city_id] = [
                    'priceCardUpto50' => $metal['card_upto_50'],
                    'priceCardFrom50' => $metal['card_from_50'],
                    'priceAccountLegal' => $metal['account_legal'],
                ];
            }
        }

        $region_log = implode("\n", $rlog);
        update_option("pmp_last_sync_{$rkey}_log", $region_log);
        update_option("pmp_last_sync_{$rkey}_time", date('d.m.Y H:i:s'));
        $log = array_merge($log, $rlog);
    }

    $log[] = '';
    $log[] = '--- Сохранение в БД ---';
    $log[] = 'Уникальных металлов: ' . count($all_metals_by_city);

    $sort_order = 0;
    foreach ($all_metals_by_city as $metal_name => $mdata) {
        $first_city = reset($mdata['cities']);
        $main_price = $first_city['priceCardFrom50'] ?? $first_city['priceCardUpto50'] ?? $first_city['priceAccountLegal'];

        $metal_record = [
            'name' => $metal_name,
            'price' => $main_price,
            'card_upto_50' => $first_city['priceCardUpto50'],
            'card_from_50' => $first_city['priceCardFrom50'],
            'account_legal' => $first_city['priceAccountLegal'],
            'category' => $mdata['category'],
            'color' => $mdata['color'],
            'prices_by_city' => $mdata['cities'],
        ];

        $result = pmp_sync_metal_v3($metal_record, $sort_order);
        if ($result === 'created') $total_metals_created++;
        elseif ($result === 'updated') $total_metals_updated++;
        $sort_order++;
    }

    $log[] = "Металлы: создано $total_metals_created, обновлено $total_metals_updated";

    if ($target_region === 'all' || $target_region === 'altai') {
        $altai_html = null;
        $altai_config = $regions['altai'];
        $llog = [];
        $altai_html = pmp_fetch_page($altai_config['url'], $llog);
        if (!$altai_html && $altai_config['fallback_url']) {
            $altai_html = pmp_fetch_page($altai_config['fallback_url'], $llog);
        }
        if ($altai_html) {
            $locations_parsed = pmp_parse_locations($altai_html);
            $log[] = 'Найдено пунктов приёма: ' . count($locations_parsed);
            $lc = 0; $lu = 0;
            foreach ($locations_parsed as $location) {
                $r = pmp_sync_location($location);
                if ($r === 'created') $lc++;
                elseif ($r === 'updated') $lu++;
            }
            $log[] = "Пункты приёма: создано $lc, обновлено $lu";

            $vacancies_parsed = pmp_parse_vacancies($altai_html);
            $log[] = 'Найдено вакансий: ' . count($vacancies_parsed);
            $vc = 0; $vu = 0;
            foreach ($vacancies_parsed as $vacancy) {
                $r = pmp_sync_vacancy($vacancy);
                if ($r === 'created') $vc++;
                elseif ($r === 'updated') $vu++;
            }
            $log[] = "Вакансии: создано $vc, обновлено $vu";
        }
    }

    $log[] = '';
    $log[] = 'Синхронизация завершена: ' . date('d.m.Y H:i:s');

    $full_log = implode("\n", $log);
    update_option('pmp_last_sync_time', date('d.m.Y H:i:s'));
    update_option('pmp_last_sync_log', $full_log);

    $summary = "Металлы: +$total_metals_created / ↻$total_metals_updated (уникальных: " . count($all_metals_by_city) . ")";
    return ['success' => true, 'message' => $summary];
}

// --- Загрузка страницы с ретраями ---
function pmp_fetch_page($url, &$log, $retries = 3) {
    for ($attempt = 1; $attempt <= $retries; $attempt++) {
        $log[] = "  Загрузка ($attempt/$retries): $url";

        $response = wp_remote_get($url, [
            'timeout' => 45,
            'user-agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'sslverify' => false,
            'headers' => [
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language' => 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            ],
        ]);

        if (is_wp_error($response)) {
            $log[] = "  Ошибка: " . $response->get_error_message();
            if ($attempt < $retries) {
                sleep(2 * $attempt);
                continue;
            }
            return null;
        }

        $status = wp_remote_retrieve_response_code($response);
        if ($status !== 200) {
            $log[] = "  HTTP $status";
            if ($attempt < $retries) {
                sleep(2 * $attempt);
                continue;
            }
            return null;
        }

        $html = wp_remote_retrieve_body($response);
        if (empty($html) || strlen($html) < 1000) {
            $log[] = "  Пустой/короткий ответ (" . strlen($html) . " байт)";
            if ($attempt < $retries) {
                sleep(2 * $attempt);
                continue;
            }
            return null;
        }

        $html = '<?xml encoding="UTF-8">' . $html;
        $log[] = "  OK: " . strlen($html) . " байт";
        return $html;
    }
    return null;
}

// --- Извлечение вкладок eael-adv-tabs ---
function pmp_extract_tabs($html, &$log) {
    $tabs = [];

    $dom = new DOMDocument();
    @$dom->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
    $xpath = new DOMXPath($dom);

    $tab_triggers = $xpath->query('//li[contains(@class, "eael-tab-item-trigger")]');
    $log[] = "  Найдено триггеров вкладок: " . $tab_triggers->length;

    $tab_contents = $xpath->query('//div[contains(@class, "eael-tab-content-item")]');
    $log[] = "  Найдено контентных блоков: " . $tab_contents->length;

    $triggers_info = [];
    foreach ($tab_triggers as $trigger) {
        $tab_id = $trigger->getAttribute('id');
        $data_tab = $trigger->getAttribute('data-tab');
        $title_nodes = $xpath->query('.//span[contains(@class, "eael-tab-title")]', $trigger);
        $title = $title_nodes->length > 0 ? trim($title_nodes->item(0)->textContent) : '';
        $triggers_info[] = [
            'tab_id' => $tab_id,
            'data_tab' => (int) $data_tab,
            'title' => $title,
        ];
        $log[] = "    Триггер: id={$tab_id}, data-tab={$data_tab}, title='{$title}'";
    }

    $content_index = 0;
    foreach ($tab_contents as $content_div) {
        $content_id = $content_div->getAttribute('id');
        $inner_html = '';
        foreach ($content_div->childNodes as $child) {
            $inner_html .= $dom->saveHTML($child);
        }

        $trigger_info = isset($triggers_info[$content_index]) ? $triggers_info[$content_index] : null;

        $tabs[] = [
            'content_id' => $content_id,
            'trigger_tab_id' => $trigger_info ? $trigger_info['tab_id'] : '',
            'data_tab' => $trigger_info ? $trigger_info['data_tab'] : $content_index + 1,
            'title' => $trigger_info ? $trigger_info['title'] : '',
            'html' => $inner_html,
        ];

        $content_index++;
    }

    return $tabs;
}

// --- Поиск контента вкладки по tab_id и data_tab ---
function pmp_find_tab_content($tabs, $tab_id, $data_tab, &$log) {
    foreach ($tabs as $tab) {
        if ($tab['trigger_tab_id'] === $tab_id && $tab['data_tab'] === $data_tab) {
            return $tab['html'];
        }
    }

    foreach ($tabs as $tab) {
        if ($tab['data_tab'] === $data_tab) {
            return $tab['html'];
        }
    }

    foreach ($tabs as $tab) {
        if ($tab['content_id'] === $tab_id . '-tab') {
            return $tab['html'];
        }
    }

    return null;
}

// --- Очистка числа из ячейки ---
function pmp_clean_price($text) {
    $text = trim($text);
    $text = preg_replace('/[\x{00A0}\x{202F}\x{2009}\s]+/u', '', $text);
    $text = str_replace(',', '.', $text);
    $text = preg_replace('/[^\d.]/', '', $text);
    $val = (float) $text;
    return $val > 0 ? $val : null;
}

// --- Определение формата таблицы по заголовку ---
function pmp_detect_table_format($xpath, $table, &$log, $city_label = '') {
    $header_rows = $xpath->query('.//tr', $table);
    if ($header_rows->length === 0) return 'unknown';

    $first_row = $header_rows->item(0);
    $th_cells = $xpath->query('.//th', $first_row);
    $td_cells = $xpath->query('.//td', $first_row);
    $cells = $th_cells->length > 0 ? $th_cells : $td_cells;
    if ($cells->length < 2) return 'unknown';

    $headers = [];
    for ($i = 0; $i < $cells->length; $i++) {
        $headers[] = mb_strtolower(trim($cells->item($i)->textContent));
    }
    $header_str = implode(' | ', $headers);
    $log[] = "    [{$city_label}] Заголовки таблицы: {$header_str}";

    $has_slash_col = false;
    $has_from_before_to = false;
    $is_ferrous = false;

    foreach ($headers as $h) {
        if (mb_strpos($h, '/') !== false && (mb_strpos($h, 'счет') !== false || mb_strpos($h, 'счёт') !== false)) {
            $has_slash_col = true;
        }
        if (mb_strpos($h, '1000') !== false || (mb_strpos($h, 'на карту') !== false && mb_strpos($h, 'до') === false && mb_strpos($h, 'от') === false)) {
            $is_ferrous = true;
        }
    }

    if (count($headers) >= 3) {
        $col1 = $headers[1];
        $col2 = $headers[2] ?? '';
        if (mb_strpos($col1, 'от') !== false && mb_strpos($col2, 'до') !== false) {
            $has_from_before_to = true;
        }
    }

    if ($has_slash_col) return 'nonferrous_slash';
    if ($has_from_before_to) return 'nonferrous_reversed';
    if ($is_ferrous) return 'ferrous';

    $first_data_row = null;
    for ($i = 0; $i < $header_rows->length; $i++) {
        $row_cells = $xpath->query('.//td', $header_rows->item($i));
        if ($row_cells->length >= 2) {
            $first_cell_text = mb_strtolower(trim($row_cells->item(0)->textContent));
            if (mb_strpos($first_cell_text, 'наименование') === false && mb_strpos($first_cell_text, 'название') === false) {
                $first_data_row = $header_rows->item($i);
                break;
            }
        }
    }

    if ($first_data_row) {
        $data_cells = $xpath->query('.//td', $first_data_row);
        if ($data_cells->length >= 3) {
            $col2_val = trim($data_cells->item(2)->textContent);
            if (mb_strpos($col2_val, '/') !== false) {
                return 'nonferrous_slash';
            }
        }
        $name_text = mb_strtolower(trim($data_cells->item(0)->textContent));
        if (mb_strpos($name_text, 'лом 3а') !== false || mb_strpos($name_text, 'лом 5а') !== false ||
            mb_strpos($name_text, 'чугун') !== false || mb_strpos($name_text, 'лом 12а') !== false) {
            return 'ferrous';
        }
    }

    return 'nonferrous_separate';
}

// --- Парсинг металлов из HTML-фрагмента вкладки ---
function pmp_parse_metals_from_html($html, &$log, $city_label = '') {
    $metals = [];

    $wrapped = '<?xml encoding="UTF-8"><html><body>' . $html . '</body></html>';
    $dom = new DOMDocument();
    @$dom->loadHTML($wrapped, LIBXML_NOERROR | LIBXML_NOWARNING);
    $xpath = new DOMXPath($dom);

    $category_map = [
        'цветн' => 'non-ferrous',
        'чёрн' => 'ferrous',
        'черн' => 'ferrous',
        'медь' => 'non-ferrous', 'медн' => 'non-ferrous',
        'алюмин' => 'non-ferrous', 'никел' => 'non-ferrous',
        'бронз' => 'non-ferrous', 'латун' => 'non-ferrous',
        'свин' => 'non-ferrous', 'олов' => 'non-ferrous',
        'нержав' => 'non-ferrous', 'титан' => 'non-ferrous',
        'цинк' => 'non-ferrous', 'вольфрам' => 'non-ferrous',
        'магн' => 'non-ferrous', 'нихром' => 'non-ferrous',
        'радиатор' => 'non-ferrous',
        'чугун' => 'ferrous', 'лом 3а' => 'ferrous',
        'лом 5а' => 'ferrous', 'лом 12а' => 'ferrous',
        'стал' => 'ferrous',
    ];

    $color_map = [
        'медь' => '#B87333', 'медн' => '#B87333',
        'алюмин' => '#A8A9AD', 'никел' => '#727472',
        'бронз' => '#CD7F32', 'латун' => '#E1C16E',
        'свин' => '#6B6B6B', 'олов' => '#D1D1D1',
        'нержав' => '#8C8C8C', 'титан' => '#878681',
        'цинк' => '#BAC4CB', 'вольфрам' => '#5A5A5A',
        'магн' => '#A0A0A0', 'нихром' => '#727472',
        'радиатор' => '#CD7F32',
        'чёрн' => '#3D3D3D', 'черн' => '#3D3D3D',
        'чугун' => '#4A4A4A', 'стал' => '#5A5A5A',
        'лом 3а' => '#3D3D3D', 'лом 5а' => '#3D3D3D',
    ];

    $tables = $xpath->query('//table');
    $log[] = "    [{$city_label}] Найдено таблиц: " . $tables->length;

    foreach ($tables as $table_index => $table) {
        $table_format = pmp_detect_table_format($xpath, $table, $log, $city_label);
        $log[] = "    [{$city_label}] Таблица #{$table_index}: формат={$table_format}";

        $current_section = 'non-ferrous';
        if ($table_format === 'ferrous') {
            $current_section = 'ferrous';
        }

        $prev_node = $table->previousSibling;
        $search_depth = 0;
        while ($prev_node && $search_depth < 10) {
            if ($prev_node->nodeType === XML_ELEMENT_NODE) {
                $text = mb_strtolower(trim($prev_node->textContent));
                if (mb_strpos($text, 'чёрн') !== false || mb_strpos($text, 'черн') !== false ||
                    mb_strpos($text, 'чугун') !== false) {
                    $current_section = 'ferrous';
                    break;
                } elseif (mb_strpos($text, 'цветн') !== false || mb_strpos($text, 'медь') !== false ||
                          mb_strpos($text, 'алюмин') !== false) {
                    $current_section = 'non-ferrous';
                    break;
                }
            }
            $prev_node = $prev_node->previousSibling;
            $search_depth++;
        }

        $rows = $xpath->query('.//tr', $table);
        $row_count = 0;

        foreach ($rows as $row) {
            $th_cells = $xpath->query('.//th', $row);
            if ($th_cells->length > 0) continue;

            $cells = $xpath->query('.//td', $row);
            if ($cells->length < 2) continue;

            $name = trim($cells->item(0)->textContent);
            if (empty($name)) continue;

            $name_lower = mb_strtolower($name);
            if (mb_strpos($name_lower, 'наименование') !== false ||
                mb_strpos($name_lower, 'название') !== false ||
                mb_strpos($name_lower, 'на карту') !== false ||
                mb_strpos($name_lower, 'на счет') !== false ||
                mb_strpos($name_lower, 'на счёт') !== false ||
                mb_strpos($name_lower, 'от 50') !== false ||
                mb_strpos($name_lower, 'от 100') !== false ||
                mb_strpos($name_lower, 'от 1000') !== false) continue;

            $card_upto_50 = null;
            $card_from_50 = null;
            $account_legal = null;

            if ($cells->length >= 3) {
                $col1_text = trim($cells->item(1)->textContent);
                $col2_text = trim($cells->item(2)->textContent);

                if ($table_format === 'nonferrous_slash') {
                    $card_upto_50 = pmp_clean_price($col1_text);
                    if (mb_strpos($col2_text, '/') !== false) {
                        $parts = preg_split('/[\/]/u', $col2_text, 2);
                        $card_from_50 = pmp_clean_price($parts[0]);
                        $account_legal = isset($parts[1]) ? pmp_clean_price($parts[1]) : $card_from_50;
                    } else {
                        $card_from_50 = pmp_clean_price($col2_text);
                        $account_legal = $card_from_50;
                    }
                } elseif ($table_format === 'nonferrous_reversed') {
                    $card_from_50 = pmp_clean_price($col1_text);
                    $card_upto_50 = pmp_clean_price($col2_text);
                    $account_legal = $card_from_50;
                } elseif ($table_format === 'ferrous') {
                    $card_from_50 = pmp_clean_price($col1_text);
                    $account_legal = pmp_clean_price($col2_text);
                } else {
                    if (mb_strpos($col2_text, '/') !== false) {
                        $card_upto_50 = pmp_clean_price($col1_text);
                        $parts = preg_split('/[\/]/u', $col2_text, 2);
                        $card_from_50 = pmp_clean_price($parts[0]);
                        $account_legal = isset($parts[1]) ? pmp_clean_price($parts[1]) : $card_from_50;
                    } else {
                        $card_from_50 = pmp_clean_price($col1_text);
                        $account_legal = pmp_clean_price($col2_text);
                    }
                }

                if ($cells->length >= 4) {
                    $col3_text = trim($cells->item(3)->textContent);
                    $card_upto_50 = pmp_clean_price($col1_text);
                    $card_from_50 = pmp_clean_price($col2_text);
                    $account_legal = pmp_clean_price($col3_text);
                }
            } elseif ($cells->length === 2) {
                $col_text = trim($cells->item(1)->textContent);
                if (mb_strpos($col_text, '/') !== false) {
                    $parts = preg_split('/[\/]/u', $col_text, 2);
                    $card_from_50 = pmp_clean_price($parts[0]);
                    $account_legal = isset($parts[1]) ? pmp_clean_price($parts[1]) : $card_from_50;
                } else {
                    $card_from_50 = pmp_clean_price($col_text);
                    $account_legal = $card_from_50;
                }
            }

            $main_price = $card_from_50 ?? $card_upto_50 ?? $account_legal;
            if ($main_price === null || $main_price <= 0) continue;

            $category = $current_section;
            foreach ($category_map as $key => $cat) {
                if (mb_strpos($name_lower, $key) !== false) {
                    $category = $cat;
                    break;
                }
            }

            $color = $category === 'ferrous' ? '#3D3D3D' : '#B87333';
            foreach ($color_map as $key => $clr) {
                if (mb_strpos($name_lower, $key) !== false) {
                    $color = $clr;
                    break;
                }
            }

            $metals[] = [
                'name' => $name,
                'price' => $main_price,
                'card_upto_50' => $card_upto_50,
                'card_from_50' => $card_from_50,
                'account_legal' => $account_legal,
                'category' => $category,
                'color' => $color,
            ];
            $row_count++;
        }

        $log[] = "    [{$city_label}] Таблица #{$table_index}: спарсено {$row_count} позиций (секция={$current_section})";
    }

    if (count($metals) > 0) {
        $sample = $metals[0];
        $log[] = "    [{$city_label}] Пример: '{$sample['name']}' upto50={$sample['card_upto_50']} from50={$sample['card_from_50']} legal={$sample['account_legal']} cat={$sample['category']}";
    }

    return $metals;
}

// --- Синхронизация металла v3 (с pricesByCity) ---
function pmp_sync_metal_v3($metal, $sort_order = 0) {
    $existing = get_posts([
        'post_type' => 'pmp_metal',
        'title' => $metal['name'],
        'post_status' => 'publish',
        'numberposts' => 1,
        'meta_query' => [['key' => '_pmp_synced', 'value' => '1']],
    ]);

    $prices_by_city_json = wp_json_encode($metal['prices_by_city'], JSON_UNESCAPED_UNICODE);

    if (!empty($existing)) {
        $post_id = $existing[0]->ID;
        $old_price = (float) get_post_meta($post_id, '_pmp_price', true);

        if ($old_price != $metal['price'] && $old_price > 0) {
            update_post_meta($post_id, '_pmp_previous_price', (string) $old_price);
        }
        update_post_meta($post_id, '_pmp_price', (string) ($metal['price'] ?? 0));
        update_post_meta($post_id, '_pmp_price_card_upto_50', $metal['card_upto_50'] !== null ? (string) $metal['card_upto_50'] : '');
        update_post_meta($post_id, '_pmp_price_card_from_50', $metal['card_from_50'] !== null ? (string) $metal['card_from_50'] : '');
        update_post_meta($post_id, '_pmp_price_account_legal', $metal['account_legal'] !== null ? (string) $metal['account_legal'] : '');
        update_post_meta($post_id, '_pmp_category', $metal['category']);
        update_post_meta($post_id, '_pmp_color', $metal['color']);
        update_post_meta($post_id, '_pmp_sort_order', (string) $sort_order);
        update_post_meta($post_id, '_pmp_prices_by_city', $prices_by_city_json);
        return 'updated';
    }

    $post_id = wp_insert_post([
        'post_type' => 'pmp_metal',
        'post_title' => $metal['name'],
        'post_status' => 'publish',
    ]);

    if (!is_wp_error($post_id)) {
        update_post_meta($post_id, '_pmp_price', (string) ($metal['price'] ?? 0));
        update_post_meta($post_id, '_pmp_previous_price', (string) ($metal['price'] ?? 0));
        update_post_meta($post_id, '_pmp_price_card_upto_50', $metal['card_upto_50'] !== null ? (string) $metal['card_upto_50'] : '');
        update_post_meta($post_id, '_pmp_price_card_from_50', $metal['card_from_50'] !== null ? (string) $metal['card_from_50'] : '');
        update_post_meta($post_id, '_pmp_price_account_legal', $metal['account_legal'] !== null ? (string) $metal['account_legal'] : '');
        update_post_meta($post_id, '_pmp_category', $metal['category']);
        update_post_meta($post_id, '_pmp_color', $metal['color']);
        update_post_meta($post_id, '_pmp_sort_order', (string) $sort_order);
        update_post_meta($post_id, '_pmp_prices_by_city', $prices_by_city_json);
        update_post_meta($post_id, '_pmp_description', '');
        update_post_meta($post_id, '_pmp_synced', '1');
        return 'created';
    }

    return 'error';
}

// --- Парсинг пунктов приёма (совместимость) ---
function pmp_parse_locations($html) {
    $locations = [];

    $known_cities = [
        'Барнаул' => ['lat' => 53.3548, 'lng' => 83.7698],
        'Новоалтайск' => ['lat' => 53.3937, 'lng' => 83.9337],
        'Рубцовск' => ['lat' => 51.5012, 'lng' => 81.2076],
        'Алейск' => ['lat' => 52.4922, 'lng' => 82.7794],
        'Заринск' => ['lat' => 53.7063, 'lng' => 84.9319],
        'Поспелиха' => ['lat' => 51.9644, 'lng' => 81.8382],
        'Искитим' => ['lat' => 54.6185, 'lng' => 83.3062],
        'Новосибирск' => ['lat' => 55.0084, 'lng' => 82.9357],
    ];

    foreach ($known_cities as $city => $coords) {
        if (mb_stripos($html, $city) !== false) {
            $phone = '+7 (905) 982-39-45';
            preg_match('/(\+7[\s\-\(]*\d{3}[\s\-\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2})/', $html, $phone_match);
            if (!empty($phone_match[1])) {
                $phone = trim($phone_match[1]);
            }

            $locations[] = [
                'name' => 'Пункт приёма — ' . $city,
                'city' => $city,
                'address' => 'г. ' . $city,
                'phone' => $phone,
                'working_hours' => 'Пн-Сб: 9:00-18:00',
                'is_main' => ($city === 'Барнаул') ? '1' : '0',
                'latitude' => $coords['lat'],
                'longitude' => $coords['lng'],
            ];
        }
    }

    return $locations;
}

// --- Парсинг вакансий (совместимость) ---
function pmp_parse_vacancies($html) {
    $vacancies = [];

    $vacancy_keywords = ['разнорабочий', 'грузчик', 'водитель', 'погрузчик', 'менеджер', 'оператор', 'бухгалтер', 'сварщик', 'резчик', 'сортировщик', 'приёмщик', 'приемщик', 'кладовщик'];
    $salary_pattern = '/(\d[\d\s]*(?:000|руб|₽|р\b)[^\n<]{0,30})/u';
    $all_text = strip_tags($html);

    foreach ($vacancy_keywords as $keyword) {
        if (mb_stripos($all_text, $keyword) !== false) {
            preg_match('/([^\n\.]*' . $keyword . '[^\n\.]{0,100})/iu', $all_text, $title_match);
            $title = !empty($title_match[1]) ? trim($title_match[1]) : ucfirst($keyword);
            $title = mb_substr($title, 0, 100);

            $salary = '';
            $context_start = max(0, mb_stripos($all_text, $keyword) - 200);
            $context = mb_substr($all_text, $context_start, 500);
            if (preg_match($salary_pattern, $context, $sal_match)) {
                $salary = trim($sal_match[1]);
            }

            $already_exists = false;
            foreach ($vacancies as $v) {
                if (mb_stripos($v['title'], $keyword) !== false) {
                    $already_exists = true;
                    break;
                }
            }
            if (!$already_exists) {
                $vacancies[] = [
                    'title' => $title,
                    'salary' => $salary,
                    'description' => 'Вакансия на предприятии по приёму и переработке металлолома.',
                    'requirements' => "Опыт работы приветствуется\nОтветственность\nГотовность к физической работе",
                    'location' => 'Алтайский край',
                ];
            }
        }
    }

    return $vacancies;
}

// --- Синхронизация пункта приёма ---
function pmp_sync_location($location) {
    $existing = get_posts([
        'post_type' => 'pmp_location',
        'title' => $location['name'],
        'post_status' => 'publish',
        'numberposts' => 1,
        'meta_query' => [['key' => '_pmp_synced', 'value' => '1']],
    ]);

    if (!empty($existing)) {
        $post_id = $existing[0]->ID;
        update_post_meta($post_id, '_pmp_address', $location['address']);
        update_post_meta($post_id, '_pmp_phone', $location['phone']);
        update_post_meta($post_id, '_pmp_working_hours', $location['working_hours']);
        update_post_meta($post_id, '_pmp_is_main', $location['is_main']);
        update_post_meta($post_id, '_pmp_latitude', (string) $location['latitude']);
        update_post_meta($post_id, '_pmp_longitude', (string) $location['longitude']);
        return 'updated';
    }

    $post_id = wp_insert_post([
        'post_type' => 'pmp_location',
        'post_title' => $location['name'],
        'post_status' => 'publish',
    ]);

    if (!is_wp_error($post_id)) {
        update_post_meta($post_id, '_pmp_address', $location['address']);
        update_post_meta($post_id, '_pmp_phone', $location['phone']);
        update_post_meta($post_id, '_pmp_working_hours', $location['working_hours']);
        update_post_meta($post_id, '_pmp_is_main', $location['is_main']);
        update_post_meta($post_id, '_pmp_latitude', (string) $location['latitude']);
        update_post_meta($post_id, '_pmp_longitude', (string) $location['longitude']);
        update_post_meta($post_id, '_pmp_synced', '1');
        return 'created';
    }

    return 'error';
}

// --- Синхронизация вакансии ---
function pmp_sync_vacancy($vacancy) {
    $existing = get_posts([
        'post_type' => 'pmp_vacancy',
        'post_status' => 'publish',
        'numberposts' => 1,
        'meta_query' => [['key' => '_pmp_synced', 'value' => '1']],
        's' => $vacancy['title'],
    ]);

    if (!empty($existing)) {
        $post_id = $existing[0]->ID;
        update_post_meta($post_id, '_pmp_salary', $vacancy['salary']);
        update_post_meta($post_id, '_pmp_vac_description', $vacancy['description']);
        update_post_meta($post_id, '_pmp_requirements', $vacancy['requirements']);
        update_post_meta($post_id, '_pmp_vac_location', $vacancy['location']);
        return 'updated';
    }

    $post_id = wp_insert_post([
        'post_type' => 'pmp_vacancy',
        'post_title' => $vacancy['title'],
        'post_status' => 'publish',
    ]);

    if (!is_wp_error($post_id)) {
        update_post_meta($post_id, '_pmp_salary', $vacancy['salary']);
        update_post_meta($post_id, '_pmp_vac_description', $vacancy['description']);
        update_post_meta($post_id, '_pmp_requirements', $vacancy['requirements']);
        update_post_meta($post_id, '_pmp_vac_location', $vacancy['location']);
        update_post_meta($post_id, '_pmp_synced', '1');
        return 'created';
    }

    return 'error';
}

// =============================================
// 9. WP-CRON — АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ
// =============================================

register_activation_hook(__FILE__, 'pmp_activate_cron');
function pmp_activate_cron() {
    if (!wp_next_scheduled('pmp_daily_sync_event')) {
        wp_schedule_event(time(), 'pmp_daily', 'pmp_daily_sync_event');
    }
}

register_deactivation_hook(__FILE__, 'pmp_deactivate_cron');
function pmp_deactivate_cron() {
    wp_clear_scheduled_hook('pmp_daily_sync_event');
}

add_filter('cron_schedules', 'pmp_add_cron_interval');
function pmp_add_cron_interval($schedules) {
    $schedules['pmp_daily'] = [
        'interval' => 86400,
        'display' => 'Раз в 24 часа (ПромМетПласт)',
    ];
    return $schedules;
}

add_action('pmp_daily_sync_event', 'pmp_cron_sync');
function pmp_cron_sync() {
    $sync_enabled = get_option('pmp_sync_enabled', '1');
    if ($sync_enabled !== '1') {
        return;
    }
    pmp_run_sync('all');
}

add_action('init', function() {
    if (get_option('pmp_sync_enabled', '1') === '1' && !wp_next_scheduled('pmp_daily_sync_event')) {
        wp_schedule_event(time() + 60, 'pmp_daily', 'pmp_daily_sync_event');
    }
});
