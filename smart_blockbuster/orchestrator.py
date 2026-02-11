"""
Оркестратор цепочки агентов «Умного блокбастера».

Адаптация паттерна State Machine + Sequential Pipeline из mediawar.core v3.3.

Поддерживает два режима:
- Автоматический: агенты выполняются последовательно без пауз
- Пошаговый (Steppable): пауза между агентами для ревью и редактирования

Конвейер:
  Scout → Radar → Analyst → Architect → Writer → [COMPLETED]
"""

from __future__ import annotations

from .agent_types import (
    AGENT_DESCRIPTIONS,
    AGENT_PIPELINE_ORDER,
    AgentType,
    PipelineState,
    StepStatus,
)
from .agents import (
    format_radar_output,
    format_research_dossier,
    format_structure_blueprint,
    format_writer_output,
    run_analyst,
    run_architect,
    run_radar,
    run_scout_interactive,
    run_writer,
)
from .analyzer import full_script_analysis
from .production import export_script_json


def _print_agent_header(agent_type: AgentType) -> None:
    """Выводит заголовок текущего агента."""
    meta = AGENT_DESCRIPTIONS[agent_type.value]
    print(f"\n{'━' * 70}")
    print(f"  [{agent_type.value.upper()}] {meta['name_ru']}")
    print(f"  Роль: {meta['role']}")
    print(f"  {meta['description'][:100]}")
    print(f"{'━' * 70}")


def _wait_for_approval(state: PipelineState, agent_name: str) -> bool:
    """
    Ожидает одобрения пользователя в пошаговом режиме.

    Возвращает True для продолжения, False для отмены.
    """
    state.step_status = StepStatus.WAITING_FOR_APPROVAL.value

    print(f"\n  [ПОШАГОВЫЙ РЕЖИМ] Агент «{agent_name}» завершён.")
    print("  Варианты:")
    print("    1. Одобрить и продолжить")
    print("    2. Отменить конвейер")

    choice = input("  Выбор (1/2): ").strip()
    if choice == "2":
        state.add_log(f"[ORCHESTRATOR] Конвейер отменён пользователем после {agent_name}.")
        print("  Конвейер отменён.")
        return False

    state.step_status = StepStatus.PROCESSING.value
    return True


def run_pipeline(steppable: bool = False) -> PipelineState:
    """
    Запускает полный конвейер агентов «Умного блокбастера».

    Конвейер: Scout → Radar → Analyst → Architect → Writer

    Args:
        steppable: True для пошагового режима с паузами между агентами.

    Returns:
        PipelineState с результатами всех агентов.
    """
    state = PipelineState(is_steppable=steppable)
    state.add_log("[ORCHESTRATOR] Запуск конвейера «Умный блокбастер»...")

    mode = "пошаговый" if steppable else "автоматический"
    print("\n" + "=" * 70)
    print("  КОНВЕЙЕР АГЕНТОВ «УМНОГО БЛОКБАСТЕРА»")
    print(f"  Режим: {mode}")
    print("  Цепочка: Scout → Radar → Analyst → Architect → Writer")
    print("=" * 70)

    # ── АГЕНТ 1: СКАУТ ──
    state.current_agent = AgentType.SCOUT.value
    state.is_processing = True
    _print_agent_header(AgentType.SCOUT)

    topic_suggestion = run_scout_interactive(state)
    state.add_log(f"[ORCHESTRATOR] Scout → тема: «{topic_suggestion.title}»")

    if steppable and not _wait_for_approval(state, "Скаут"):
        return state

    # ── АГЕНТ 2: РАДАР ──
    state.current_agent = AgentType.RADAR.value
    _print_agent_header(AgentType.RADAR)

    radar_output = run_radar(state, topic_suggestion)
    print(format_radar_output(radar_output))

    if steppable and not _wait_for_approval(state, "Радар"):
        return state

    # ── АГЕНТ 3: АНАЛИТИК ──
    state.current_agent = AgentType.ANALYST.value
    _print_agent_header(AgentType.ANALYST)

    dossier = run_analyst(state, radar_output)
    print(format_research_dossier(dossier))

    if steppable and not _wait_for_approval(state, "Аналитик"):
        return state

    # ── АГЕНТ 4: АРХИТЕКТОР ──
    state.current_agent = AgentType.ARCHITECT.value
    _print_agent_header(AgentType.ARCHITECT)

    blueprint = run_architect(state, dossier)
    print(format_structure_blueprint(blueprint))

    if steppable and not _wait_for_approval(state, "Архитектор"):
        return state

    # ── АГЕНТ 5: СЦЕНАРИСТ ──
    state.current_agent = AgentType.WRITER.value
    _print_agent_header(AgentType.WRITER)

    writer_output = run_writer(state, blueprint, dossier)
    print(format_writer_output(writer_output))

    # ── ЗАВЕРШЕНИЕ ──
    state.current_agent = AgentType.COMPLETED.value
    state.is_processing = False

    # Полный анализ качества
    print("\n" + full_script_analysis(writer_output.script))

    # Экспорт
    export_path = f"script_{state.topic[:30].replace(' ', '_')}.json"
    try:
        export_script_json(writer_output.script, export_path)
        state.add_log(f"[ORCHESTRATOR] Сценарий экспортирован: {export_path}")
        print(f"\n  Сценарий сохранён: {export_path}")
    except Exception as e:
        state.add_log(f"[ORCHESTRATOR] Ошибка экспорта: {e}")

    # Итоговый отчёт
    _print_pipeline_summary(state)

    state.add_log("[ORCHESTRATOR] Конвейер завершён.")
    return state


def _print_pipeline_summary(state: PipelineState) -> None:
    """Выводит итоговый отчёт о работе конвейера."""
    print("\n" + "=" * 70)
    print("  ИТОГОВЫЙ ОТЧЁТ КОНВЕЙЕРА")
    print("=" * 70)

    print(f"\n  Тема: «{state.topic}»")

    if state.writer_output:
        wo = state.writer_output
        print(f"  Блоков A/V: {wo.block_count}")
        print(f"  Слов: {wo.word_count}")
        dur = wo.script.total_duration_sec
        print(f"  Длительность: {dur // 60}:{dur % 60:02d}")

    print(f"\n  Лог агентов ({len(state.logs)} записей):")
    # Показываем последние 15 записей
    for log_entry in state.logs[-15:]:
        print(f"    {log_entry}")

    print("\n" + "=" * 70)
    print("  Конвейер завершён. Используйте JSON-файл для дальнейшей работы.")
    print("=" * 70)


def show_pipeline_info() -> None:
    """Показывает информацию о конвейере агентов."""
    print("\n" + "=" * 70)
    print("  ЦЕПОЧКА АГЕНТОВ «УМНОГО БЛОКБАСТЕРА»")
    print("  (Адаптация Chain of Agents из mediawar.core v3.3)")
    print("=" * 70)

    for i, agent_type in enumerate(AGENT_PIPELINE_ORDER, 1):
        meta = AGENT_DESCRIPTIONS[agent_type.value]
        arrow = " → " if i < len(AGENT_PIPELINE_ORDER) else " → [ГОТОВО]"
        print(f"\n  {i}. {meta['name_ru']}")
        print(f"     Роль: {meta['role']}")
        print(f"     {meta['description']}")
        if i < len(AGENT_PIPELINE_ORDER):
            next_meta = AGENT_DESCRIPTIONS[AGENT_PIPELINE_ORDER[i].value]
            print(f"     Далее → {next_meta['name_ru']}")

    print("\n  Режимы:")
    print("    - Автоматический: агенты выполняются без пауз")
    print("    - Пошаговый: пауза между агентами для ревью")
