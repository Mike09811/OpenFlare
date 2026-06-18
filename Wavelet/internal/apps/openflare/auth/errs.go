// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package auth

const (
	errInvalidParams           = "无效的参数"
	errUnauthorized            = "无权进行此操作，未登录或 token 无效"
	errPasswordLoginDisabled   = "管理员关闭了密码登录"
	errUsernameOrPasswordWrong = "用户名或密码错误"
	errBannedAccount           = "用户已被封禁"
	errSaveSessionFailed       = "无法保存会话信息，请重试"
	errRegistrationDisabled    = "管理员关闭了注册"
	errPasswordTooShort        = "密码长度不能少于 8 位"
	errEmailRequired           = "邮箱地址不能为空"
	errEmailAlreadyRegistered  = "邮箱地址已被占用"
	errEmailNotRegistered      = "该邮箱地址未注册"
	errEmailCodeInvalid        = "验证码错误或已过期"
	errResetLinkInvalid        = "重置链接非法或已过期"
	errUserNotFound            = "用户不存在"
	errGenerateTokenFailed     = "生成 Token 失败"
	errInsufficientPermission  = "无权进行此操作，权限不足"
	errCannotDisableRoot       = "无法禁用超级管理员用户"
	errCannotDeleteRoot        = "无法删除超级管理员用户"
	errCannotPromoteAdmin      = "普通管理员用户无法提升其他用户为管理员"
	errAlreadyAdmin            = "该用户已经是管理员"
	errAlreadyCommonUser       = "该用户已经是普通用户"
	errAuthSourceDisabled      = "认证源未启用"
	errInvalidAuthSourceID     = "认证源 ID 无效"
	errPendingOAuthExpired     = "待绑定第三方账号已失效，请重新登录"
	errPendingOAuthInvalid     = "待绑定第三方账号无效，请重新登录"
	errCapTokenMissing         = "缺少人机验证凭证"
	errCapTokenInvalid         = "人机验证凭证无效或已过期"
)
