"""
Реализация 5 ИИ-агентов цепочки «Умного блокбастера».

Адаптация архитектуры Chain of Agents из mediawar.core v3.3
под методологию синтеза Кэллоуэя + Харриса.

Каждый агент:
1. Получает вход от предыдущего агента
2. Выполняет специализированную обработку
3. Выдаёт типизированный выход для следующего агента
4. Поддерживает ручное редактирование в пошаговом режиме
"""

from __future__ import annotations

import random

from .models import (
    AVLine,
    AVScript,
    ContentType,
    CONTENT_TYPE_META,
    EvidenceLoop,
    Hook,
    HookArchetype,
    HookStep,
    HOOK_ARCHETYPE_META,
    ScriptBlock,
    SerratedPhase,
    SERRATED_PHASE_META,
    VisualType,
)
from .agent_types import (
    PipelineState,
    RadarOutput,
    ResearchDossier,
    StructureBlueprint,
    TopicSuggestion,
    WriterOutput,
)
from .hook_engine import validate_hook, format_validation_report, format_hook
from .structure import (
    generate_serrated_edge,
    format_serrated_edge,
    format_evidence_loop,
    analyze_but_therefore,
    format_but_therefore_report,
)
from .analyzer import (
    analyze_staccato,
    format_staccato_report,
    analyze_connectors,
    format_connectors_report,
    full_script_analysis,
)
from .production import format_av_script, export_script_json


# ═══════════════════════════════════════════════════════════════════
# АГЕНТ 1: СКАУТ (SCOUT)
# Аналог: mediawar Scout — сканирует поле и предлагает темы
# ═══════════════════════════════════════════════════════════════════

def run_scout(state: PipelineState) -> list[TopicSuggestion]:
    """
    Агент «Скаут» — генерирует 4 предложения тем для «Умного блокбастера».

    Использует типологию контента из Таблицы 2 мануала и 6 архетипов хуков.
    В реальной интеграции здесь будет вызов LLM с Google Search.
    """
    state.add_log("[SCOUT] Запуск агента Скаут...")
    state.add_log("[SCOUT] Сканирование информационного поля...")

    suggestions: list[TopicSuggestion] = []

    # Генерируем по одной теме для каждого типа контента
    content_types = list(ContentType)
    archetypes = [
        HookArchetype.INVESTIGATOR,
        HookArchetype.TEACHER,
        HookArchetype.MAGICIAN,
        HookArchetype.CONTRARIAN,
    ]
    viral_factors = ["Страх / FOMO", "Справедливость / Гнев", "Деньги / Выгода", "Секрет / Инсайд"]

    for i, ct in enumerate(content_types):
        meta = CONTENT_TYPE_META[ct.value]
        suggestions.append(TopicSuggestion(
            title=meta["example"].strip("«»"),
            hook_idea=f"Визуальный якорь: {meta['visual_anchor']}",
            content_type=ct,
            archetype=archetypes[i],
            viral_factor=viral_factors[i],
        ))

    state.add_log(f"[SCOUT] Найдено {len(suggestions)} тем.")
    state.scout_suggestions = suggestions
    return suggestions


def run_scout_interactive(state: PipelineState) -> TopicSuggestion:
    """Интерактивный Скаут: показывает темы и даёт выбрать."""
    suggestions = run_scout(state)

    print("\n" + "=" * 70)
    print("  АГЕНТ 1: СКАУТ (SCOUT)")
    print("  Предложения тем для «Умного блокбастера»")
    print("=" * 70)

    for i, s in enumerate(suggestions, 1):
        arch_meta = HOOK_ARCHETYPE_META[s.archetype.value]
        ct_meta = CONTENT_TYPE_META[s.content_type.value]
        print(f"\n  {i}. {s.title}")
        print(f"     Тип: {ct_meta['name_ru']} | Архетип: {arch_meta['name_ru']}")
        print(f"     Хук: {s.hook_idea}")
        print(f"     Вирусный фактор: {s.viral_factor}")

    print(f"\n  5. Ввести свою тему")

    while True:
        try:
            choice = int(input("\n  Выберите тему (1-5): "))
            if 1 <= choice <= 5:
                break
        except ValueError:
            pass
        print("  Введите число от 1 до 5.")

    if choice == 5:
        custom_title = input("  Введите тему: ").strip()
        state.topic = custom_title
        return TopicSuggestion(
            title=custom_title,
            hook_idea="",
            content_type=ContentType.INVESTIGATION,
            archetype=HookArchetype.INVESTIGATOR,
            viral_factor="Пользовательская тема",
        )

    selected = suggestions[choice - 1]
    state.topic = selected.title
    state.content_type = selected.content_type.value
    state.add_log(f"[SCOUT] Выбрана тема: «{selected.title}»")
    return selected


# ═══════════════════════════════════════════════════════════════════
# АГЕНТ 2: РАДАР (RADAR)
# Аналог: mediawar Radar — определяет вирусные углы
# ═══════════════════════════════════════════════════════════════════

def run_radar(state: PipelineState, topic_suggestion: TopicSuggestion) -> RadarOutput:
    """
    Агент «Радар» — анализирует вирусные углы темы.

    Применяет Дофаминовую лестницу Кэллоуэя и определяет:
    - 3 вирусных угла (гипотезы видео)
    - Дофаминовые крючки для удержания
    - Контрарный отскок (Contrarian Snapback)
    """
    state.add_log(f"[RADAR] Запуск агента Радар для: «{topic_suggestion.title}»...")
    state.add_log("[RADAR] Анализ вирусных триггеров (Метод Кэллоуэя)...")

    arch_meta = HOOK_ARCHETYPE_META[topic_suggestion.archetype.value]

    radar = RadarOutput(
        topic=topic_suggestion.title,
        viral_angles=[
            f"Угол «Следователь»: Что скрывают? Документ/факт, который замалчивают.",
            f"Угол «Противник»: Это не ошибка — это умысел Системы.",
            f"Угол «Предсказатель»: Если [событие], то [последствие для зрителя].",
        ],
        dopamine_hooks=[
            "Открытая петля: задать вопрос, ответ через 3 минуты",
            "Визуальный шокер: показать артефакт в кадре 0",
            "Перезацеп каждые 2-3 минуты: новый конфликт",
            "Микро-раскрытия: промежуточные «улики» на пути к разгадке",
        ],
        target_emotion=topic_suggestion.viral_factor,
        contrarian_take=(
            f"Контрарный отскок для архетипа «{arch_meta['name_ru']}»:\n"
            f"{arch_meta['adaptation']}"
        ),
    )

    state.radar_output = radar
    state.add_log("[RADAR] Вирусные углы определены.")
    return radar


def format_radar_output(radar: RadarOutput) -> str:
    """Форматирует выход Радара для отображения."""
    lines = [
        "=" * 70,
        f"  АГЕНТ 2: РАДАР (RADAR)",
        f"  Тема: «{radar.topic}»",
        "=" * 70,
        "\n  Вирусные углы (3 гипотезы видео):",
    ]
    for i, angle in enumerate(radar.viral_angles, 1):
        lines.append(f"    {i}. {angle}")

    lines.append("\n  Дофаминовые крючки:")
    for hook in radar.dopamine_hooks:
        lines.append(f"    - {hook}")

    lines.append(f"\n  Целевая эмоция: {radar.target_emotion}")
    lines.append(f"\n  Контрарный отскок:\n    {radar.contrarian_take}")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════
# АГЕНТ 3: АНАЛИТИК (ANALYST)
# Аналог: mediawar Analyst — факт-чекинг + визуальные якоря
# ═══════════════════════════════════════════════════════════════════

def run_analyst(state: PipelineState, radar: RadarOutput) -> ResearchDossier:
    """
    Агент «Аналитик» — формирует исследовательское досье.

    Собирает:
    - Утверждения и контр-утверждения (двухвекторный поиск)
    - 7+ визуальных якорей (метод Харриса)
    - Ключевые цифры (data points)
    - Петли доказательств (Evidence Loops)
    - Злодея, Жертву и Шокирующий артефакт
    """
    state.add_log(f"[ANALYST] Запуск агента Аналитик...")
    state.add_log("[ANALYST] Двухвекторный поиск: основные + альтернативные источники...")

    dossier = ResearchDossier(
        topic=radar.topic,
        claims=[
            f"[Утверждение 1] Основной нарратив по теме «{radar.topic}» (Источник, Дата)",
            f"[Утверждение 2] Официальная позиция / мейнстрим-версия (Источник, Дата)",
            f"[Утверждение 3] Статистика или отчёт (Источник, Дата)",
        ],
        counter_claims=[
            f"[Контр-утверждение 1] Альтернативный взгляд на «{radar.topic}» (Источник, Дата)",
            f"[Контр-утверждение 2] Скрытый аспект / замалчиваемый факт (Источник, Дата)",
        ],
        visual_anchors=[
            "Секретный документ / отчёт с грифом",
            "Карта с аномалией или выделенной зоной",
            "График с резким изменением тренда",
            "Фотография ключевого события",
            "Скриншот переписки / контракта",
            "Инфографика сравнения (до/после)",
            "Таймлайн событий с датами",
        ],
        data_points=[
            {"label": "Ключевая цифра #1", "value": "[Заполнить конкретным числом]"},
            {"label": "Ключевая цифра #2", "value": "[Заполнить конкретным числом]"},
            {"label": "Сравнение", "value": "[X vs Y: разница в N раз]"},
        ],
        evidence_loops=[
            EvidenceLoop(
                context=f"Гипотеза о «{radar.topic}».",
                deictic_driver="Посмотрите на этот документ.",
                evidence=f"[Визуальный якорь: {dossier_anchor}]",
                reveal="Интерпретация: это означает, что...",
                transition="НО это создаёт новую проблему, СЛЕДОВАТЕЛЬНО...",
            )
            for dossier_anchor in ["документ с грифом", "карта с аномалией", "график тренда"]
        ],
        villain=f"Система / Институт, скрывающий правду о «{radar.topic}»",
        victim="Зритель / обычный человек, который не знает правды",
        shocking_artifact=f"Конкретный документ/карта/данные, доказывающие скрытую правду о «{radar.topic}»",
    )

    state.research_dossier = dossier
    state.add_log(f"[ANALYST] Досье сформировано: {len(dossier.visual_anchors)} визуальных якорей, "
                   f"{len(dossier.evidence_loops)} петель доказательств.")
    return dossier


def format_research_dossier(dossier: ResearchDossier) -> str:
    """Форматирует исследовательское досье."""
    lines = [
        "=" * 70,
        f"  АГЕНТ 3: АНАЛИТИК (ANALYST)",
        f"  Исследовательское досье: «{dossier.topic}»",
        "=" * 70,
        "\n  УТВЕРЖДЕНИЯ (основные источники):",
    ]
    for c in dossier.claims:
        lines.append(f"    - {c}")

    lines.append("\n  КОНТР-УТВЕРЖДЕНИЯ (альтернативный взгляд):")
    for c in dossier.counter_claims:
        lines.append(f"    - {c}")

    lines.append("\n  ВИЗУАЛЬНЫЕ ЯКОРЯ (метод Харриса):")
    for i, a in enumerate(dossier.visual_anchors, 1):
        lines.append(f"    {i}. {a}")

    lines.append("\n  КЛЮЧЕВЫЕ ЦИФРЫ:")
    for dp in dossier.data_points:
        lines.append(f"    - {dp['label']}: {dp['value']}")

    lines.append(f"\n  ЗЛОДЕЙ (Система): {dossier.villain}")
    lines.append(f"  ЖЕРТВА (Зритель): {dossier.victim}")
    lines.append(f"  ШОКИРУЮЩИЙ АРТЕФАКТ: {dossier.shocking_artifact}")

    lines.append("\n  ПЕТЛИ ДОКАЗАТЕЛЬСТВ:")
    for i, loop in enumerate(dossier.evidence_loops, 1):
        lines.append(format_evidence_loop(loop, i))

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════
# АГЕНТ 4: АРХИТЕКТОР (ARCHITECT)
# Аналог: mediawar Architect — проектирует структуру
# ═══════════════════════════════════════════════════════════════════

def run_architect(state: PipelineState, dossier: ResearchDossier) -> StructureBlueprint:
    """
    Агент «Архитектор» — проектирует структуру видео.

    Создаёт:
    - Трёхшаговый хук (формула синтеза)
    - Зубчатую дугу (Serrated Edge)
    - Цепочку But/Therefore
    - Концепцию превью
    """
    state.add_log("[ARCHITECT] Запуск агента Архитектор...")
    state.add_log("[ARCHITECT] Проектирование Зубчатой дуги + Хук...")

    duration_min = 12

    # Конструируем хук
    archetype = HookArchetype.INVESTIGATOR
    if state.content_type:
        ct_meta = CONTENT_TYPE_META.get(state.content_type, {})
        approach = ct_meta.get("hook_approach", "")
        if "Противник" in approach:
            archetype = HookArchetype.CONTRARIAN
        elif "Учитель" in approach:
            archetype = HookArchetype.TEACHER
        elif "Волшебник" in approach:
            archetype = HookArchetype.MAGICIAN

    hook = Hook(
        archetype=archetype,
        step1_anchor=HookStep(
            name="Контекстное вовлечение + Якорь",
            goal="Мгновенная ясность темы + Сенсорное доказательство",
            text=f"Посмотрите на это. [{dossier.shocking_artifact}]",
            visual=f"[{dossier.visual_anchors[0] if dossier.visual_anchors else 'Визуальный якорь'}]",
        ),
        step2_interjection=HookStep(
            name="Интервенция остановки",
            goal="Паттерн-интеррапт: сбить инерцию мышления",
            text="Но подождите. Это не то, что вы думаете.",
            visual="Резкий зум, смена цветокоррекции, звук скретча",
        ),
        step3_snapback=HookStep(
            name="Контрарный отскок",
            goal="Создание разрыва (Curiosity Gap)",
            text=f"Потому что за этим скрывается проблема, о которой вам никто не расскажет.",
            visual="Инфографика / карта / документ с хайлайтом ключевой фразы",
        ),
    )

    # Зубчатая дуга
    blocks = generate_serrated_edge(duration_min)

    # Привязываем петли доказательств к блокам расследования
    loop_idx = 0
    for block in blocks:
        if block.phase in (SerratedPhase.INVESTIGATION, SerratedPhase.REHOOK):
            if loop_idx < len(dossier.evidence_loops):
                block.evidence_loops.append(dossier.evidence_loops[loop_idx])
                loop_idx += 1

    # But/Therefore цепочка
    bt_chain = (
        f"Обещание: раскрыть правду о «{dossier.topic}».\n"
        f"НО официальная версия говорит одно.\n"
        f"СЛЕДОВАТЕЛЬНО мы проверили первичные источники.\n"
        f"НО обнаружили противоречие.\n"
        f"СЛЕДОВАТЕЛЬНО это меняет всю картину.\n"
        f"НО возникает этический вопрос.\n"
        f"СЛЕДОВАТЕЛЬНО зритель должен решить сам."
    )

    blueprint = StructureBlueprint(
        title=dossier.topic[:60],
        promise=f"Раскрыть скрытую правду о «{dossier.topic}»",
        hook=hook,
        blocks=blocks,
        thumbnail_concept=(
            f"Левый нижний угол: лицо автора (эмоция шока). "
            f"Правая часть: {dossier.visual_anchors[0] if dossier.visual_anchors else 'документ'}. "
            f"Высокий контраст, красный акцент."
        ),
        duration_min=duration_min,
        but_therefore_chain=bt_chain,
    )

    state.structure_blueprint = blueprint
    state.add_log("[ARCHITECT] Структура спроектирована.")
    return blueprint


def format_structure_blueprint(bp: StructureBlueprint) -> str:
    """Форматирует структурный план."""
    lines = [
        "=" * 70,
        f"  АГЕНТ 4: АРХИТЕКТОР (ARCHITECT)",
        f"  Структурный план: «{bp.title}»",
        "=" * 70,
        f"\n  Обещание: {bp.promise}",
        f"  Длительность: {bp.duration_min} мин",
        f"\n  Концепция превью:\n    {bp.thumbnail_concept}",
    ]

    # Хук
    lines.append("\n" + format_hook(bp.hook))

    # Валидация хука
    from .hook_engine import validate_hook, format_validation_report
    results = validate_hook(bp.hook)
    lines.append("\n" + format_validation_report(results))

    # Зубчатая дуга
    lines.append("\n" + format_serrated_edge(bp.blocks))

    # But/Therefore
    lines.append(f"\n  ЦЕПОЧКА BUT/THEREFORE:\n    {bp.but_therefore_chain}")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════
# АГЕНТ 5: СЦЕНАРИСТ (WRITER)
# Аналог: mediawar Writer — генерирует финальный сценарий
# ═══════════════════════════════════════════════════════════════════

_SFX_MAP: dict[str, str] = {
    VisualType.DOCUMENT.value: "paper rustle",
    VisualType.MAP.value: "paper rustle",
    VisualType.TEXT_OVERLAY.value: "whoosh",
    VisualType.SNAP_ZOOM.value: "boom hit",
    VisualType.BROLL.value: "",
    VisualType.STOCK_FOOTAGE.value: "",
    VisualType.MEME_REFERENCE.value: "comedy sting",
    VisualType.TALKING_HEAD.value: "",
}

_MUSIC_MAP: dict[str, str] = {
    SerratedPhase.HIGH_START.value: "ambient тревожный",
    SerratedPhase.CONTEXT_BRIDGE.value: "ambient спокойный",
    SerratedPhase.REHOOK.value: "driving beat нарастающий",
    SerratedPhase.INVESTIGATION.value: "driving beat ритмичный",
    SerratedPhase.SYNTHESIS.value: "epic пиано / оркестр",
}


def run_writer(state: PipelineState, blueprint: StructureBlueprint,
               dossier: ResearchDossier) -> WriterOutput:
    """
    Агент «Сценарист» — генерирует полный двухколоночный A/V сценарий.

    Применяет:
    - Стиль Стаккато (короткие предложения)
    - Дейктические драйверы Харриса
    - Коннекторы Coffee Shop Tone
    - Принцип But/Therefore
    - SFX и музыкальные указания
    - Pattern Interrupts (визуальное разнообразие)
    """
    state.add_log("[WRITER] Запуск агента Сценарист...")
    state.add_log("[WRITER] Генерация A/V сценария в стиле Стаккато...")

    av_lines: list[AVLine] = []
    current_sec = 0

    # --- ХУК (первые 5 секунд) ---
    for i, step in enumerate(blueprint.hook.steps()):
        dur = 2 if i < 2 else 3
        tc = f"{current_sec // 60:02d}:{current_sec % 60:02d}"
        vtype = VisualType.DOCUMENT if i == 0 else (VisualType.SNAP_ZOOM if i == 1 else VisualType.TEXT_OVERLAY)
        av_lines.append(AVLine(
            timecode=tc,
            audio_text=step.text,
            visual_description=step.visual or f"[{step.name}]",
            visual_type=vtype,
            sfx=_SFX_MAP.get(vtype.value, ""),
            music_mood=_MUSIC_MAP[SerratedPhase.HIGH_START.value],
        ))
        current_sec += dur

    # --- БЛОКИ ЗУБЧАТОЙ ДУГИ ---
    visual_types_cycle = [
        VisualType.TALKING_HEAD, VisualType.DOCUMENT, VisualType.MAP,
        VisualType.BROLL, VisualType.TEXT_OVERLAY, VisualType.STOCK_FOOTAGE,
        VisualType.SNAP_ZOOM, VisualType.TALKING_HEAD, VisualType.DOCUMENT,
    ]
    vtype_idx = 0

    for block in blueprint.blocks:
        phase = block.phase
        music = _MUSIC_MAP.get(phase.value, "")

        # Генерируем строки для петель доказательств
        for loop in block.evidence_loops:
            # 1. Контекст
            vtype = visual_types_cycle[vtype_idx % len(visual_types_cycle)]
            vtype_idx += 1
            tc = f"{current_sec // 60:02d}:{current_sec % 60:02d}"
            av_lines.append(AVLine(tc, loop.context, f"[{vtype.value}]",
                                    vtype, _SFX_MAP.get(vtype.value, ""), music))
            current_sec += 4

            # 2. Дейктический драйвер + Визуальный якорь
            vtype = VisualType.DOCUMENT
            vtype_idx += 1
            tc = f"{current_sec // 60:02d}:{current_sec % 60:02d}"
            av_lines.append(AVLine(tc, loop.deictic_driver, f"[{loop.evidence}]",
                                    vtype, "paper rustle", music))
            current_sec += 3

            # 3. Микро-раскрытие
            vtype = VisualType.TEXT_OVERLAY
            tc = f"{current_sec // 60:02d}:{current_sec % 60:02d}"
            av_lines.append(AVLine(tc, loop.reveal, "[Хайлайт ключевой фразы]",
                                    vtype, "whoosh", music))
            current_sec += 4

            # 4. Переход
            vtype = VisualType.SNAP_ZOOM
            vtype_idx += 1
            tc = f"{current_sec // 60:02d}:{current_sec % 60:02d}"
            av_lines.append(AVLine(tc, loop.transition, "[Зум на автора / новый визуал]",
                                    vtype, "boom hit", music))
            current_sec += 3

        # Перезацеп (если есть)
        if block.rehook_text:
            vtype = VisualType.SNAP_ZOOM
            tc = f"{current_sec // 60:02d}:{current_sec % 60:02d}"
            av_lines.append(AVLine(tc, block.rehook_text, "[Резкая смена кадра / новый конфликт]",
                                    vtype, "boom hit", _MUSIC_MAP.get(SerratedPhase.REHOOK.value, "")))
            current_sec += 3

    # --- ФИНАЛ: Синтез ---
    tc = f"{current_sec // 60:02d}:{current_sec % 60:02d}"
    av_lines.append(AVLine(tc, "Честно говоря, ответ не так прост.",
                            "[Автор крупным планом, мягкий свет]",
                            VisualType.TALKING_HEAD, "", _MUSIC_MAP[SerratedPhase.SYNTHESIS.value]))
    current_sec += 4

    tc = f"{current_sec // 60:02d}:{current_sec % 60:02d}"
    av_lines.append(AVLine(tc, "На самом деле, вопрос остаётся открытым. И решать вам.",
                            "[Чёрный экран с текстом вопроса]",
                            VisualType.TEXT_OVERLAY, "whoosh", _MUSIC_MAP[SerratedPhase.SYNTHESIS.value]))
    current_sec += 5

    # Собираем AVScript
    script = AVScript(
        title=blueprint.title,
        promise=blueprint.promise,
        hook=blueprint.hook,
        blocks=blueprint.blocks,
        av_lines=av_lines,
        total_duration_sec=current_sec,
    )

    word_count = sum(len(line.audio_text.split()) for line in av_lines)

    output = WriterOutput(
        script=script,
        word_count=word_count,
        block_count=len(av_lines),
    )

    state.writer_output = output
    state.add_log(f"[WRITER] Сценарий готов: {output.block_count} блоков, "
                   f"{output.word_count} слов, {current_sec} сек.")
    return output


def format_writer_output(output: WriterOutput) -> str:
    """Форматирует финальный выход Сценариста."""
    lines = [
        "=" * 70,
        f"  АГЕНТ 5: СЦЕНАРИСТ (WRITER)",
        f"  Финальный сценарий: «{output.script.title}»",
        "=" * 70,
        f"\n  Блоков: {output.block_count}",
        f"  Слов: {output.word_count}",
        f"  Длительность: {output.script.total_duration_sec // 60}:{output.script.total_duration_sec % 60:02d}",
    ]

    lines.append("\n" + format_av_script(output.script))
    return "\n".join(lines)
