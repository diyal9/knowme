"""Fixed DeepEval bridge for KnowMe Agent evaluation.

Reads one JSON request from stdin and emits a marker-prefixed JSON response.
It never executes user-provided code and uses standalone metric.measure calls,
so Confident AI cloud persistence is not required.
"""

from __future__ import annotations

import json
import sys
import traceback
from typing import Any


MARKER = "__KNOWME_DEEPEVAL_RESULT__="


def emit(payload: dict[str, Any]) -> None:
    print(f"{MARKER}{json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}")


def tool_call(raw: dict[str, Any]):
    from deepeval.test_case import ToolCall

    kwargs: dict[str, Any] = {"name": str(raw.get("name") or "")}
    if raw.get("description"):
        kwargs["description"] = str(raw["description"])
    if "output" in raw:
        kwargs["output"] = raw["output"]
    input_parameters = raw.get("inputParameters")
    if input_parameters is not None:
        # DeepEval releases have accepted both the canonical model field and
        # the shorter constructor alias. Prefer the canonical field first.
        kwargs["input_parameters"] = input_parameters
    try:
        return ToolCall(**kwargs)
    except TypeError:
        if "input_parameters" in kwargs:
            kwargs["input"] = kwargs.pop("input_parameters")
        return ToolCall(**kwargs)


def test_case(raw: dict[str, Any]):
    from deepeval.test_case import LLMTestCase

    observation = raw.get("observation") or {}
    kwargs: dict[str, Any] = {
        "input": str(raw.get("input") or ""),
        "actual_output": str(observation.get("actualOutput") or ""),
    }
    if raw.get("expectedOutput") is not None:
        kwargs["expected_output"] = str(raw["expectedOutput"])
    if raw.get("context"):
        kwargs["context"] = [str(item) for item in raw["context"]]
    if raw.get("retrievalContext"):
        kwargs["retrieval_context"] = [str(item) for item in raw["retrievalContext"]]
    if observation.get("toolsCalled"):
        kwargs["tools_called"] = [tool_call(item) for item in observation["toolsCalled"]]
    if raw.get("expectedTools"):
        kwargs["expected_tools"] = [tool_call(item) for item in raw["expectedTools"]]
    return LLMTestCase(**kwargs)


def single_turn_params():
    try:
        from deepeval.test_case import SingleTurnParams
        return SingleTurnParams
    except ImportError:
        from deepeval.test_case import LLMTestCaseParams
        return LLMTestCaseParams


def metric_instance(raw: dict[str, Any], judge_model: str):
    from deepeval.metrics import (
        AnswerRelevancyMetric,
        ArgumentCorrectnessMetric,
        FaithfulnessMetric,
        GEval,
        HallucinationMetric,
    )

    metric_type = str(raw.get("type") or "")
    kwargs: dict[str, Any] = {
        "threshold": float(raw.get("threshold", 0.7)),
        "include_reason": True,
        "verbose_mode": False,
    }
    if judge_model:
        kwargs["model"] = judge_model
    if raw.get("strict"):
        kwargs["strict_mode"] = True
    if metric_type == "answer_relevancy":
        return AnswerRelevancyMetric(**kwargs)
    if metric_type == "faithfulness":
        return FaithfulnessMetric(**kwargs)
    if metric_type == "hallucination":
        return HallucinationMetric(**kwargs)
    if metric_type == "argument_correctness":
        return ArgumentCorrectnessMetric(**kwargs)
    if metric_type == "g_eval":
        params_type = single_turn_params()
        supported = {
            "input": params_type.INPUT,
            "actual_output": params_type.ACTUAL_OUTPUT,
            "expected_output": params_type.EXPECTED_OUTPUT,
            "context": params_type.CONTEXT,
            "retrieval_context": params_type.RETRIEVAL_CONTEXT,
        }
        requested = [str(item).lower() for item in raw.get("evaluationParams") or []]
        evaluation_params = [supported[item] for item in requested if item in supported]
        if not evaluation_params:
            evaluation_params = [params_type.ACTUAL_OUTPUT, params_type.EXPECTED_OUTPUT]
        return GEval(
            name=str(raw.get("name") or raw.get("id") or "Agent quality"),
            criteria=str(raw.get("criteria") or ""),
            evaluation_params=evaluation_params,
            **kwargs,
        )
    raise ValueError(f"Unsupported DeepEval metric: {metric_type}")


def evaluate(payload: dict[str, Any]) -> dict[str, Any]:
    import deepeval

    judge_model = str(payload.get("judgeModel") or "")
    results: list[dict[str, Any]] = []
    metrics = payload.get("metrics") or []
    for case_raw in payload.get("cases") or []:
        case_id = str(case_raw.get("id") or "")
        try:
            case = test_case(case_raw)
        except Exception as error:  # pragma: no cover - guarded in JS tests
            for metric_raw in metrics:
                results.append({
                    "caseId": case_id,
                    "metricId": str(metric_raw.get("id") or ""),
                    "error": f"test_case_invalid: {error}",
                })
            continue
        for metric_raw in metrics:
            metric_id = str(metric_raw.get("id") or "")
            try:
                metric = metric_instance(metric_raw, judge_model)
                metric.measure(case)
                score = getattr(metric, "score", None)
                results.append({
                    "caseId": case_id,
                    "metricId": metric_id,
                    "score": float(score) if score is not None else None,
                    "passed": bool(metric.is_successful()) if hasattr(metric, "is_successful") else None,
                    "reason": str(getattr(metric, "reason", "") or ""),
                })
            except Exception as error:
                results.append({
                    "caseId": case_id,
                    "metricId": metric_id,
                    "code": "deepeval_metric_failed",
                    "error": str(error),
                })
    return {
        "ok": True,
        "version": str(getattr(deepeval, "__version__", "")),
        "results": results,
    }


def main() -> None:
    try:
        request = json.loads(sys.stdin.read() or "{}")
        action = str(request.get("action") or "")
        if action == "status":
            import deepeval
            emit({
                "ok": True,
                "version": str(getattr(deepeval, "__version__", "")),
            })
            return
        if action == "evaluate":
            emit(evaluate(request.get("payload") or {}))
            return
        emit({"ok": False, "code": "invalid_action", "error": "Unsupported bridge action"})
    except ModuleNotFoundError as error:
        emit({
            "ok": False,
            "code": "deepeval_unavailable",
            "error": f"DeepEval 未安装: {error}",
        })
    except Exception as error:  # keep the bridge structured for host diagnostics
        emit({
            "ok": False,
            "code": "deepeval_bridge_failed",
            "error": str(error),
            "trace": traceback.format_exc(limit=4),
        })


if __name__ == "__main__":
    main()
