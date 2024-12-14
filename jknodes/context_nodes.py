import os
import sys
import comfy.samplers
import folder_paths

# these are based on (copied from) rgthree contexts but i wanted to add some stuff

this_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.dirname(this_dir))

_all_context_input_output_data = {
    "base_ctx": ("base_ctx", "JK_CONTEXT", "CONTEXT"),
    "base_model": ("base_model", "MODEL", "BASE_MODEL", "the base model without any patching or LORA applied"),
    "model": ("model", "MODEL", "MODEL", "model with loras applied (if any)"),
    "base_clip": ("base_clip", "CLIP", "BASE_CLIP"),
    "clip": ("clip", "CLIP", "CLIP"),
    "vae": ("vae", "VAE", "VAE"),
    "positive": ("positive", "CONDITIONING", "POSITIVE"),
    "negative": ("negative", "CONDITIONING", "NEGATIVE"),
    "latent": ("latent", "LATENT", "LATENT"),
    "images": ("images", "IMAGE", "IMAGE"),
    "seed": ("seed", "INT", "SEED"),
    "wildcard_seed": ("wildcard_seed", "INT", "WILDCARD_SEED"),
    "steps": ("steps", "INT", "STEPS"),
    "step_refiner": ("step_refiner", "INT", "STEP_REFINER"),
    "cfg": ("cfg", "FLOAT", "CFG"),
    "ckpt_name": (
        "ckpt_name",
        folder_paths.get_filename_list("checkpoints"),
        "CKPT_NAME",
    ),
    "sampler": ("sampler", comfy.samplers.KSampler.SAMPLERS, "SAMPLER"),
    "scheduler": ("scheduler", comfy.samplers.KSampler.SCHEDULERS, "SCHEDULER"),
    "clip_width": ("clip_width", "INT", "CLIP_WIDTH"),
    "clip_height": ("clip_height", "INT", "CLIP_HEIGHT"),
    "text_pos_g": ("text_pos_g", "STRING", "TEXT_POS_G"),
    "text_pos_l": ("text_pos_l", "STRING", "TEXT_POS_L"),
    "text_neg_g": ("text_neg_g", "STRING", "TEXT_NEG_G"),
    "text_neg_l": ("text_neg_l", "STRING", "TEXT_NEG_L"),
    "mask": ("mask", "MASK", "MASK"),
    "control_net_stack": ("control_net_stack", "cnet_stack", "CONTROL_NET_STACK"),
}

force_input_types = ["INT", "STRING", "FLOAT"]
force_input_names = ["sampler", "scheduler", "ckpt_name"]


def _create_context_data(input_list=None):
    """Returns a tuple of context inputs, return types, and return names to use in a node"s def"""
    if input_list is None:
        input_list = _all_context_input_output_data.keys()
    list_ctx_return_types = []
    list_ctx_return_names = []
    ctx_optional_inputs = {}
    for inp in input_list:
        data = _all_context_input_output_data[inp]
        list_ctx_return_types.append(data[1])
        list_ctx_return_names.append(data[2])
        ctx_optional_inputs[data[0]] = tuple([data[1]] + ([{"forceInput": True}] if data[1] in force_input_types or data[0] in force_input_names else []))
        if len(data) > 3:
            if len(ctx_optional_inputs[data[0]]) < 2:
                ctx_optional_inputs[data[0]] = ctx_optional_inputs[data[0]] + ({},)
            ctx_optional_inputs[data[0]][1]['tooltip'] = data[3]

    ctx_return_types = tuple(list_ctx_return_types)
    ctx_return_names = tuple(list_ctx_return_names)
    return (ctx_optional_inputs, ctx_return_types, ctx_return_names)


ALL_CTX_OPTIONAL_INPUTS, ALL_CTX_RETURN_TYPES, ALL_CTX_RETURN_NAMES = (_create_context_data())

_original_ctx_inputs_list = [
    "base_ctx",
    "base_model",
    "model",
    "base_clip",
    "clip",
    "vae",
    "positive",
    "negative",
    "latent",
    "images",
    "seed",
]
ORIG_CTX_OPTIONAL_INPUTS, ORIG_CTX_RETURN_TYPES, ORIG_CTX_RETURN_NAMES = (_create_context_data(_original_ctx_inputs_list))


def new_context(base_ctx, **kwargs):
    """Creates a new context from the provided data, with an optional base ctx to start."""
    context = base_ctx if base_ctx is not None else None
    new_ctx = {}
    for key in _all_context_input_output_data:
        if key == "base_ctx":
            continue
        v = kwargs[key] if key in kwargs else None
        new_ctx[key] = (v if v is not None else context[key] if context is not None and key in context else None)
    return new_ctx


def merge_new_context(*args):
    """Creates a new context by merging provided contexts with the latter overriding same fields."""
    new_ctx = {}
    for key in _all_context_input_output_data:
        if key == "base_ctx":
            continue
        v = None
        # Move backwards through the passed contexts until we find a value and use it.
        for ctx in reversed(args):
            v = ctx[key] if not is_context_empty(ctx) and key in ctx else None
            if v is not None:
                break
        new_ctx[key] = v
    return new_ctx


def get_context_return_tuple(ctx, inputs_list=None):
    """Returns a tuple for returning in the order of the inputs list."""
    if inputs_list is None:
        inputs_list = _all_context_input_output_data.keys()
    tup_list = [
        ctx,
    ]
    for key in inputs_list:
        if key == "base_ctx":
            continue
        tup_list.append(ctx[key] if ctx is not None and key in ctx else None)
    return tuple(tup_list)


def get_orig_context_return_tuple(ctx):
    """Returns a tuple for returning from a node with only the original context keys."""
    return get_context_return_tuple(ctx, _original_ctx_inputs_list)


def is_context_empty(ctx):
    """Checks if the provided ctx is None or contains just None values."""
    return not ctx or all(v is None for v in ctx.values())


class JKBigContext:
    CATEGORY = "JK Comfy Helpers/Context"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": ALL_CTX_OPTIONAL_INPUTS,
            "hidden": {},
        }

    RETURN_TYPES = ALL_CTX_RETURN_TYPES
    RETURN_NAMES = ALL_CTX_RETURN_NAMES
    FUNCTION = "convert"

    def convert(self, base_ctx=None, **kwargs):
        ctx = new_context(base_ctx, **kwargs)
        return get_context_return_tuple(ctx)


class JKLilContext:
    CATEGORY = "JK Comfy Helpers/Context"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": ORIG_CTX_OPTIONAL_INPUTS,
            "hidden": {"version": "FLOAT"},
        }

    RETURN_TYPES = ORIG_CTX_RETURN_TYPES
    RETURN_NAMES = ORIG_CTX_RETURN_NAMES
    FUNCTION = "convert"

    def convert(self, base_ctx=None, **kwargs):
        ctx = new_context(base_ctx, **kwargs)
        return get_orig_context_return_tuple(ctx)


NODE_CLASS_MAPPINGS = {"JKLilContext": JKLilContext, "JKBigContext": JKBigContext}
NODE_DISPLAY_NAME_MAPPINGS = {
    "JKLilContext": "JK Lil Context",
    "JKBigContext": "JK Big Context",
}
